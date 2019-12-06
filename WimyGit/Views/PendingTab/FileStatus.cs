
namespace WimyGit.UserControls
{
	public class FileStatus
	{
		private PendingTabViewModel pendingTabViewModel_;
		private bool is_selected_ = false;

		public string Status { get; set; }
		public string FilePath { get; set; }
		public string Display { get; set; }
		public bool IsSelected {
			get { return is_selected_; }
			set {
				is_selected_ = value;
				pendingTabViewModel_.StageSelectedCommand.RaiseCanExecuteChanged();
				pendingTabViewModel_.StageSelectedPartialCommand.RaiseCanExecuteChanged();
			}
		}

		public FileStatus(PendingTabViewModel pendingTabViewModel)
		{
			pendingTabViewModel_ = pendingTabViewModel;
		}
	}
}
