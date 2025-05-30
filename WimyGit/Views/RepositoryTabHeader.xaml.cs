﻿using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace WimyGit.UserControls
{
	public partial class RepositoryTabHeader : UserControl
	{
		private TabControl tab_control_;

		public RepositoryTabHeader(System.Windows.Controls.TabControl tab_control, string path)
		{
			tab_control_ = tab_control;
			InitializeComponent();

            ToolTip = path;
        }

        public void SetRepositoryPath (string path)
        {
            if (path == null)
            {
                Title.Content = "[[New Tab]]";
                return;
            }
            Path.Content = path;
            Title.Content = Util.GetRepositoryName(path);
            ToolTip = path;
        }

		private void CloseButton_Click(object sender, RoutedEventArgs e)
		{
			CloseThisTab();
		}

		private void Grid_MouseUp(object sender, MouseButtonEventArgs e)
		{
			if (e.ChangedButton == MouseButton.Middle)
			{
				CloseThisTab();
			}
		}

		private void CloseThisTab()
		{
			foreach (TabItem tab_item in tab_control_.Items)
			{
				if (tab_item.Header == this)
				{
					tab_control_.Items.Remove(tab_item);

                    GlobalSetting.GetInstance().ConfigModel.CollectTabInfoAndSave(tab_control_.Items);

					return;
				}
			}
		}
	}
}
