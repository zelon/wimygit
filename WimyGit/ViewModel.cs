using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.ComponentModel;
using System.Windows.Input;

namespace WimyGit {
  public class DelegateCommand : ICommand {
    private Action<object> execute_;
    private Predicate<object> can_execute_;
    public event EventHandler CanExecuteChanged;

    public DelegateCommand(Action<object> executeMethod, Predicate<object> canExecuteMethod) {
      execute_ = executeMethod;
      can_execute_ = canExecuteMethod;
    }

    public bool CanExecute(object parameter) {
      return can_execute_(parameter);
    }

    public void Execute(object parameter) {
      execute_(parameter);
    }

  }

  class ViewModel : System.ComponentModel.INotifyPropertyChanged, OutputInterface {

    public ViewModel() {
      this.ChangeDirectory = new DelegateCommand(this.OnChangeDirectory, this.CanChangeDirectory);
      this.Directory = @"E:\git\WimyGit";
    }

    void OnChangeDirectory(object parameter) {
      RunExternal run = new RunExternal(@"C:\Program Files (x86)\Git\bin\git.exe", Directory, this);
      run.Run("status");
    }

    bool CanChangeDirectory(object parameter) {
      return true;
    }

    public event PropertyChangedEventHandler PropertyChanged;

    public ICommand ChangeDirectory { get; private set; }
    public void OnOutput(string output) {
      AddLog(output);
    }

    public string Directory { get; set; }

    private string log_;
    public string Log {
      get { return log_; }
      set { log_ = value; }
    }
    public void AddLog(string log) {
      log_ += log + "\n";
      var handler = this.PropertyChanged;
      if (handler != null) {
        handler(this, new PropertyChangedEventArgs("Log"));
      }
    }
  }
}
