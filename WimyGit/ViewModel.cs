using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.ComponentModel;
using System.Windows.Input;

namespace WimyGit
{
    public class DelegateCommand : ICommand
    {
        private Action<object> execute_;
        private Predicate<object> can_execute_;
        public event EventHandler CanExecuteChanged;

        public DelegateCommand(Action<object> executeMethod, Predicate<object> canExecuteMethod)
        {
            execute_ = executeMethod;
            can_execute_ = canExecuteMethod;
        }

        public bool CanExecute(object parameter)
        {
            return can_execute_(parameter);
        }

        public void Execute(object parameter)
        {
            execute_(parameter);
        }

    }

    class ViewModel : System.ComponentModel.INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        private GitWrapper git_;

        public class FileStatus
        {
            public string Status { get; set; }
            public string FilePath { get; set; }
        }

        public ViewModel()
        {
            this.ChangeDirectory = new DelegateCommand(this.OnChangeDirectory, this.CanChangeDirectory);
            this.Directory = @"E:\git\WimyGit";
            this.ModifiedList = new System.Collections.ObjectModel.ObservableCollection<FileStatus>();
        }

        void OnChangeDirectory(object parameter)
        {
            git_ = new GitWrapper(Directory);
            var filelist = git_.GetModifiedFileList();
            this.ModifiedList.Clear();
            foreach (var filestatus in filelist)
            {
                if (filestatus.State == LibGit2Sharp.FileStatus.Ignored)
                {
                    continue;
                }
                FileStatus status = new FileStatus();
                status.Status = filestatus.State.ToString();
                status.FilePath = filestatus.FilePath;
                this.ModifiedList.Add(status);
                AddLog(String.Format("[{0}] {1}", filestatus.State.ToString(), filestatus.FilePath));
            }

            PropertyChanged(this, new PropertyChangedEventArgs("ModifiedList"));
        }
        bool CanChangeDirectory(object parameter) { return true; }
        public ICommand ChangeDirectory { get; private set; }
        public string Directory { get; set; }

        private string log_;
        public string Log
        {
            get { return log_; }
            set { log_ = value; }
        }
        public void AddLog(string log)
        {
            log_ += log + "\n";
            var handler = this.PropertyChanged;
            if (handler != null)
            {
                handler(this, new PropertyChangedEventArgs("Log"));
            }
        }

        public System.Collections.ObjectModel.ObservableCollection<FileStatus> ModifiedList { get; set; }

        private void SelectedItemChange(object sender, EventArgs e)
        {
            return;
        }
    }
}
