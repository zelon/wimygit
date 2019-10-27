
namespace WimyGit.ViewModels
{
	public class FileStatus
	{
		private RepositoryViewModel repositoryViewModel_;
		private bool is_selected_ = false;

		public string Status { get; set; }
		public string FilePath { get; set; }
		public string Display { get; set; }
		public bool IsSelected {
			get { return is_selected_; }
			set {
				is_selected_ = value;
                repositoryViewModel_.StageSelectedCommand.RaiseCanExecuteChanged();
                repositoryViewModel_.StageSelectedPartialCommand.RaiseCanExecuteChanged();
			}
		}

		public FileStatus(RepositoryViewModel repositoryViewModel)
		{
            repositoryViewModel_ = repositoryViewModel;
		}
	}
}
