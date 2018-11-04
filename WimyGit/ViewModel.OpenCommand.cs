using System.Windows.Input;

namespace WimyGit
{
	partial class ViewModel
	{
		private ICommand open_explorer_;
		public ICommand OpenExplorer {
			get {
				return open_explorer_ ?? (open_explorer_ = new DelegateCommand((object parameter) => {
					RunExternal runner = new RunExternal("explorer.exe", Directory);
					runner.RunWithoutWaiting(Directory);
				}));
			}
		}

		private ICommand open_git_bash_;
		public ICommand OpenGitBash {
			get {
				return open_git_bash_ ?? (open_git_bash_ = new DelegateCommand((object parameter) => {
					RunExternal runner = new RunExternal(ProgramPathFinder.GetGitShell(), Directory);
					runner.RunShell("--login -i");
				}));
			}
		}
	}
}
