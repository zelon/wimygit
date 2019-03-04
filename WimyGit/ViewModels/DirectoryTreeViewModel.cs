using System;
using System.IO;
using System.Collections.ObjectModel;

namespace WimyGit.ViewModels
{
    public class DirectoryTreeViewModel : NotifyBase
    {
        ObservableCollection<TreeData> TreeItems_ = new ObservableCollection<TreeData>();
        public ObservableCollection<TreeData> TreeItems {
            get { return TreeItems_; }
            set {
                TreeItems_ = value;
            }
        }

        private ViewModel viewModel_;
        private string RootPath { get; set; }

        public DirectoryTreeViewModel(ViewModel viewModel)
        {
            viewModel_ = viewModel;
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

            TreeItems = newTreeItems;

            NotifyPropertyChanged("TreeItems");
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
            viewModel_.SelectedPath = path;
            viewModel_.HistoryTabMember.RefreshHistory(path);
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
