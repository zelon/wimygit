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
				return;
			}
			string repository_path = paths[0];
			var check_directory_result = Util.CheckDirectory(repository_path);
			if (check_directory_result == Util.DirectoryCheckResult.kSuccess)
			{
				new_tab_result_(repository_path);
				return;
			}
			Service.GetInstance().ShowMsg(string.Format("Invalid directory:{0},error:{1}",
										  repository_path, check_directory_result.ToString()));
		}
	}
}
