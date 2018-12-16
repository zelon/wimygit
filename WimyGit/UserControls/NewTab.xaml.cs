using System;
using System.Windows.Controls;

namespace WimyGit.UserControls
{
	/// <summary>
	/// Interaction logic for NewTab.xaml
	/// </summary>
	public partial class NewTab : UserControl
	{
		private Action<string> new_tab_result_;

		public NewTab(Action<string> new_tab_result)
		{
			new_tab_result_ = new_tab_result;

			InitializeComponent();

			DataContext = new NewTabViewModel(new_tab_result);
		}

		private void Grid_DragOver(object sender, System.Windows.DragEventArgs e)
		{
			e.Effects = System.Windows.DragDropEffects.All;
		}

		private void Grid_Drop(object sender, System.Windows.DragEventArgs e)
		{
			string[] paths = (string[])e.Data.GetData(System.Windows.DataFormats.FileDrop);

			if (paths.Length != 1)
			{
				Service.GetInstance().ShowMsg("Please drop one directory only");
				return;
			}
			string repository_path = paths[0];
			if (Util.IsValidGitDirectory(repository_path) == false)
			{
				Service.GetInstance().ShowMsg(string.Format("Invalid git root directory:{0}", repository_path));
				return;
			}
			new_tab_result_(repository_path);
		}
	}
}
