using System;
using System.Collections.Generic;
using System.IO;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text.RegularExpressions;
using System.Windows.Input;
using WimyGitLib;

namespace WimyGit.ViewModels
{
    public class DirectoryTreeViewModel : NotifyBase
    {
        ObservableCollection<TreeData> TreeItems_ = new ObservableCollection<TreeData>();
        public ICommand ShowInExplorerCommand { get; private set; }
        public ICommand OpenTerminalCommand { get; private set; }
        public ICommand LfsLockCommand { get; private set; }
        public string LastSelectedPath { get; set; }

        private HashSet<string> _lfsTrackedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        private bool _hasLfsLockableExtensions;
        public bool HasLfsLockableExtensions
        {
            get => _hasLfsLockableExtensions;
            private set
            {
                _hasLfsLockableExtensions = value;
                NotifyPropertyChanged(nameof(HasLfsLockableExtensions));
            }
        }

        public ObservableCollection<TreeData> TreeItems {
            get { return TreeItems_; }
            set {
                TreeItems_ = value;
            }
        }

        private RepositoryViewModel repositoryViewModel_;
        private string RootPath { get; set; }

        public DirectoryTreeViewModel(RepositoryViewModel repositoryViewModel)
        {
            ShowInExplorerCommand = new DelegateCommand(OnShowInExplorerCommand);
            OpenTerminalCommand = new DelegateCommand(OnOpenTerminalCommand);
            LfsLockCommand = new DelegateCommand(OnLfsLockCommand, CanLfsLock);
            repositoryViewModel_ = repositoryViewModel;
        }

        public void OnShowInExplorerCommand(object sender)
        {
            var treeData = (DirectoryTreeViewModel.TreeData)sender;
            if (treeData == null)
            {
                return;
            }
            var path = treeData.Path;
            if (File.Exists(path))
            {
                // 윈도우 파일 탐색기에서 해당 파일을 선택한 채로 탐색기 열기
                System.Diagnostics.Process.Start("explorer.exe", $"/select, \"{path}\"");
            }
            else if (Directory.Exists(path))
            {
                // 윈도우 파일 탐색기에서 해당 폴더 열기
                System.Diagnostics.Process.Start("explorer.exe", path);
            }
            else
            {
                // 경로가 유효하지 않은 경우 처리
                System.Windows.MessageBox.Show("Invalid path: " + path);
            }
        }

        public void OnOpenTerminalCommand(object sender)
        {
            var treeData = (DirectoryTreeViewModel.TreeData)sender;
            if (treeData == null)
            {
                return;
            }
            string path = treeData.Path;
            if (File.Exists(path))
            {
                path = Path.GetDirectoryName(path);
            }
            if (Directory.Exists(path))
            {
                // cmd.exe 에서 해당 폴더 열기
                System.Diagnostics.Process.Start("cmd.exe", $"/K cd \"{path}\"");
            }
            else
            {
                // 경로가 유효하지 않은 경우 처리
                System.Windows.MessageBox.Show("Invalid path: " + path);
            }
        }



        public void SetTreeViewRootPath(string directory)
        {
            RootPath = directory;

            if (String.IsNullOrEmpty(RootPath))
            {
                return;
            }
            ObservableCollection<TreeData> newTreeItems = new ObservableCollection<TreeData>();

            newTreeItems.Add(CreateRootNode(RootPath));

            newTreeItems[0].IsSelected = true;
            newTreeItems[0].IsExpanded = true;

            TreeItems = newTreeItems;

            NotifyPropertyChanged("TreeItems");

            LoadLfsExtensions();
        }

        private void LoadLfsExtensions()
        {
            _lfsTrackedExtensions = GitAttributes.GetLfsLockableExtensions(repositoryViewModel_.Directory);
            HasLfsLockableExtensions = _lfsTrackedExtensions.Count > 0;
        }

        private bool CanLfsLock(object parameter)
        {
            var treeData = parameter as TreeData;
            if (treeData == null) return false;
            if (!File.Exists(treeData.Path)) return false;
            string ext = Path.GetExtension(treeData.Path);
            return _lfsTrackedExtensions.Contains(ext);
        }

        private async void OnLfsLockCommand(object parameter)
        {
            var treeData = parameter as TreeData;
            if (treeData == null) return;

            string relativePath = Path.GetRelativePath(repositoryViewModel_.Directory, treeData.Path);
            var runner = repositoryViewModel_.CreateGitRunner();

            repositoryViewModel_.AddLog("LFS Lock: " + relativePath);
            List<string> output = runner.Run(GitCommandCreator.LfsLock(relativePath));
            string outputText = string.Join("\n", output);

            if (output.Any(line => line.Contains("Locked")))
            {
                await repositoryViewModel_.Refresh();
                return;
            }

            string owner = TryExtractOwnerFromOutput(outputText);
            if (string.IsNullOrEmpty(owner))
            {
                List<string> locksList = runner.Run(GitCommandCreator.LfsLocksForFile(relativePath));
                owner = TryExtractOwnerFromLocksList(locksList, relativePath);
            }

            string errorMsg = string.IsNullOrEmpty(owner)
                ? $"LFS Lock failed:\n\n{outputText}"
                : $"LFS Lock failed: {relativePath} is already locked by {owner}";

            UIService.ShowMessage(errorMsg);
            await repositoryViewModel_.Refresh();
        }

        private string TryExtractOwnerFromOutput(string outputText)
        {
            var match = Regex.Match(outputText, @"already locked by\s+(\S+)");
            return match.Success ? match.Groups[1].Value : null;
        }

        private string TryExtractOwnerFromLocksList(List<string> lines, string relativePath)
        {
            string filename = Path.GetFileName(relativePath);
            foreach (var line in lines)
            {
                if (!line.Contains(filename)) continue;
                var parts = Regex.Split(line.Trim(), @"\t|\s{2,}");
                if (parts.Length >= 2)
                    return parts[1];
            }
            return null;
        }

        TreeData CreateRootNode(string path)
        {
            TreeData root = new TreeData() { Name = path, Path = path, IsExpanded = false };
            FillItemByTag(root);
            return root;
        }

        static private void FillItemByTag(TreeData treeData)
        {
            treeData.Children = null;

            string[] dirs;
            try
            {
                if (Directory.Exists(treeData.Path) == false)
                {
                    return;
                }
                dirs = Directory.GetDirectories(treeData.Path);
            }
            catch(Exception)
            {
                return;
            }

            foreach (var dir in dirs)
            {
                TreeData subItem = new TreeData();
                subItem.Name = "[" + new DirectoryInfo(dir).Name + "]";
                subItem.Path = dir;
                try
                {
                    if (Directory.GetDirectories(dir).Length > 0 ||
                        Directory.GetFiles(dir).Length > 0)
                    {
                        subItem.Children = new ObservableCollection<TreeData>();
                        subItem.Children.Add(null);
                    }
                }
                catch { }

                if (treeData.Children == null)
                {
                    treeData.Children = new ObservableCollection<TreeData>();
                }
                treeData.Children.Add(subItem);
            }
            AddFileItems(treeData, treeData.Path);
        }

        public void ReloadTreeView()
        {
            if (string.IsNullOrEmpty(RootPath))
            {
                return;
            }
            ObservableCollection<TreeData> oldTreeItems = TreeItems_;

            ObservableCollection<TreeData> newTreeItems = new ObservableCollection<TreeData>();
            newTreeItems.Add(CreateRootNode(RootPath));

            CompareAndUpdate(oldTreeItems, newTreeItems);

            TreeItems.Clear();
            foreach (var item in newTreeItems)
            {
                TreeItems.Add(item);
            }

            NotifyPropertyChanged("TreeItems");

            LoadLfsExtensions();
        }

        private void CompareAndUpdate(ObservableCollection<TreeData> oldTreeDatas, ObservableCollection<TreeData> newTreeDatas)
        {
            foreach (var newTreeData in newTreeDatas)
            {
                foreach (var oldTreeData in oldTreeDatas)
                {
                    if (newTreeData.Path != oldTreeData.Path)
                    {
                        continue;
                    }
                    newTreeData.IsSelected = oldTreeData.IsSelected;
                    newTreeData.IsExpanded = oldTreeData.IsExpanded;
                    if (newTreeData.IsExpanded)
                    {
                        FillItemByTag(newTreeData);
                        newTreeData.IsSelected = oldTreeData.IsSelected;
                        CompareAndUpdate(oldTreeDatas:oldTreeData.Children, newTreeDatas:newTreeData.Children);
                    }
                }
            }
        }

        static void AddFileItems(TreeData root, string directory)
        {
            foreach (var file in Directory.GetFiles(directory))
            {
                TreeData subItem = new TreeData();
                subItem.Name = new FileInfo(file).Name;
                subItem.Path = file;
                if (root.Children == null)
                {
                    root.Children = new ObservableCollection<TreeData>();
                }
                root.Children.Add(subItem);
            }
        }

        public void OnSelectedPathChanged(string path)
        {
            if (repositoryViewModel_.git_ == null)
            {
                return;
            }
            repositoryViewModel_.SelectedPath = path;

            // Only refresh history if the path actually changed
            if (LastSelectedPath != path)
            {
                LastSelectedPath = path;
                repositoryViewModel_.HistoryTabMember.RefreshHistory(path);
            }
        }

        public class TreeData : NotifyBase
        {
            private string _Name;
            public string Name {
                get { return _Name; }
                set {
                    _Name = value;
                    NotifyPropertyChanged("Name");
                }
            }

            private string _Path;
            public string Path {
                get { return _Path; }
                set {
                    _Path = value;
                    NotifyPropertyChanged("Path");
                }
            }

            private bool _IsExpanded;
            public bool IsExpanded {
                get { return _IsExpanded; }
                set {
                    _IsExpanded = value;
                    NotifyPropertyChanged("IsExpanded");

                    if (_IsExpanded)
                    {
                        OnExpanded();
                    }
                }
            }

            private bool _IsSelected;
            public bool IsSelected {
                get { return _IsSelected; }
                set {
                    _IsSelected = value;
                    NotifyPropertyChanged("IsSelected");
                }
            }

            private ObservableCollection<TreeData> _Children = new ObservableCollection<TreeData>();
            public ObservableCollection<TreeData> Children {
                get { return _Children; }
                set {
                    _Children = value;
                    NotifyPropertyChanged("Children");
                }
            }

            void OnExpanded()
            {
                FillItemByTag(this);
            }
        }
    }
}
