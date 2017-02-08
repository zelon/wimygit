using System;
using System.Threading.Tasks;
using System.Windows;

namespace WimyGit {
  public partial class WaitingWindow : Window {
    public WaitingWindow (string text, Action action) {
      InitializeComponent();
      textBox.Text = text;
      action_ = action;
    }

    private async void Window_Loaded (Object sender, RoutedEventArgs e) {
      var task = Task<int>.Run(() => this.Run());
      await task;
      this.Close();
    }

    private int Run() {
      action_();
      return 0;
    }

    private Action action_;
  }
}
