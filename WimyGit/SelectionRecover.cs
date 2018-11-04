using System.Collections.ObjectModel;
using System.Linq;

namespace WimyGit
{
	class SelectionRecover
	{
		private string[] selected_list_;

		public SelectionRecover(ObservableCollection<ViewModel.FileStatus> list)
		{
			selected_list_ = list.Where((ViewModel.FileStatus s) => s.IsSelected).Select((ViewModel.FileStatus s) => s.FilePath).ToArray();
		}

		public bool WasSelected(string filepath)
		{
			return selected_list_.Contains(filepath);
		}
	}
}
