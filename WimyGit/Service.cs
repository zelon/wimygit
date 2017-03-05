using System;

namespace WimyGit {
  class Service {
    private static Service instance_ = null;
    private MainWindow window_ = null;

    public static Service GetInstance () {
      if (instance_ == null) {
        instance_ = new Service();
      }
      return instance_;
    }

    private Service () {

    }

    public void SetWindow (MainWindow window) {
      window_ = window;
    }

    public void ShowMsg (string msg) {
      System.Windows.MessageBox.Show(window_, msg);
    }

    public MainWindow GetWindow () {
      return window_;
    }

    public System.Windows.MessageBoxResult ConfirmMsg (string msg, string caption) {
      return System.Windows.MessageBox.Show(msg, caption, System.Windows.MessageBoxButton.OKCancel);
    }

    public void SetRootPath (string directory) {
      window_.SetRootPath(directory);
    }

    public void RefreshDirectoryTree () {
      window_.TreeView_Update(null, null);
    }

    public void RunCommandWithWaitingWindow (string command, Action action) {
      var waiting_window = new WaitingWindow(command, action);
      waiting_window.Owner = GetWindow();
      waiting_window.Width = GetWindow().Width - 100;
      waiting_window.ShowDialog();
    }
  }
}
