using System.Collections.ObjectModel;
using System.Linq;

namespace WimyGit.ViewModels
{
	class SelectionRecover
	{
		private string[] selected_list_;

		public SelectionRecover(ObservableCollection<FileStatus> list)
		{
			selected_list_ = list.Where((FileStatus s) => s.IsSelected).Select((FileStatus s) => s.FilePath).ToArray();
		}

		public bool WasSelected(string filepath)
		{
			return selected_list_.Contains(filepath);
		}
	}
}
