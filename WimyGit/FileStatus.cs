namespace WimyGit
{
    partial class ViewModel
    {
        public class FileStatus
        {
            private ViewModel view_model_;
            private bool is_selected_ = false;

            public string Status { get; set; }
            public string FilePath { get; set; }
            public string Display { get; set; }
            public bool IsSelected
            {
                get { return is_selected_; }
                set
                {
                    is_selected_ = value;
                    view_model_.StageSelectedCommand.RaiseCanExecuteChanged();
                    view_model_.StageSelectedPartialCommand.RaiseCanExecuteChanged();
                }
            }

            public FileStatus(ViewModel view_model)
            {
                view_model_ = view_model;
            }
        }
    }
}
