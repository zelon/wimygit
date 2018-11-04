using System;
using System.Diagnostics;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Markup;
using System.Xml;

namespace WimyGit
{
	public partial class RepositoryTab
	{
		// https://code.msdn.microsoft.com/windowsdesktop/File-system-TreeView-72549a6f
		private string RootPath { get; set; }
		private string SelectedPath { get; set; }

		private void SetTreeViewRootPath(string directory)
		{
			RootPath = directory;
			treeView.Items.Clear();
			TreeView_Loaded(null, null);
		}

		void TreeView_Loaded(object sender, RoutedEventArgs e)
		{
			if (String.IsNullOrEmpty(RootPath))
			{
				return;
			}
			/// Create main expanded node of TreeView
			treeView.Items.Add(TreeView_CreateComputerItem(RootPath));
		}

		public void TreeView_Update(object not_used_sender, EventArgs not_used_e)
		{
			if (String.IsNullOrEmpty(RootPath))
			{
				return;
			}
			Stopwatch s = new Stopwatch();
			s.Start();
			/// Update drives and folders in Computer
			/// create copy for detect what item was expanded
			TreeView oldTreeView = CloneUsingXaml(treeView) as TreeView;
			/// populate items from scratch
			treeView.Items.Clear();
			/// add computer expanded node with all drives
			treeView.Items.Add(TreeView_CreateComputerItem(RootPath));
			TreeViewItem newComputerItem = treeView.Items[0] as TreeViewItem;
			TreeViewItem oldComputerItem = oldTreeView.Items[0] as TreeViewItem;
			/// Save old state of item
			newComputerItem.IsExpanded = oldComputerItem.IsExpanded;
			newComputerItem.IsSelected = oldComputerItem.IsSelected;
			/// check all drives for creating it's root folders
			foreach (TreeViewItem newDrive in (treeView.Items[0] as TreeViewItem).Items)
			{
				if (newDrive.Items.Contains(null))
				{
					/// Find relative old item for newDrive
					foreach (TreeViewItem oldDrive in oldComputerItem.Items)
					{
						if (oldDrive.Tag as string == newDrive.Tag as string)
						{
							newDrive.IsSelected = oldDrive.IsSelected;
							if (oldDrive.IsExpanded)
							{
								newDrive.Items.Clear();
								TreeView_AddDirectoryItems(oldDrive, newDrive);
							}
							break;
						}
					}
				}
			}
			s.Stop();
			Debug.WriteLine(String.Format("TreeView_Update finished with {0} ms.", s.ElapsedMilliseconds));
		}

		void TreeView_AddDirectoryItems(TreeViewItem oldItem, TreeViewItem newItem)
		{
			newItem.IsExpanded = oldItem.IsExpanded;
			newItem.IsSelected = oldItem.IsSelected;
			/// add folders in this drive
			string[] directories = Directory.GetDirectories(newItem.Tag as string);
			/// for each folder create TreeViewItem
			foreach (string directory in directories)
			{
				TreeViewItem treeViewItem = new TreeViewItem();
				treeViewItem.Header = "[" + new DirectoryInfo(directory).Name + "]";
				treeViewItem.Tag = directory;
				try
				{
					if (Directory.GetDirectories(directory).Length > 0 ||
						Directory.GetFiles(directory).Length > 0)
					{
						/// find respective old folder
						foreach (TreeViewItem oldDir in oldItem.Items)
						{
							if (oldDir.Tag as string == directory)
							{
								if (oldDir.IsExpanded)
								{
									TreeView_AddDirectoryItems(oldDir, treeViewItem);
								}
								else
								{
									treeViewItem.Items.Add(null);
								}
								break;
							}
						}
					}
				}
				catch { }
				treeViewItem.Expanded += TreeViewItem_Expanded;
				if (treeViewItem.Tag as string == SelectedPath)
				{
					treeViewItem.IsSelected = true;
				}
				newItem.Items.Add(treeViewItem);
			}
			AddFileItems(newItem, newItem.Tag as string);
		}

		TreeViewItem TreeView_CreateComputerItem(string root_directory)
		{
			TreeViewItem root = new TreeViewItem { Header = root_directory, IsExpanded = true, Tag = root_directory };
			FillItemByTag(root);
			return root;
		}

		void FillItemByTag(TreeViewItem item)
		{
			item.Items.Clear();

			string[] dirs;
			try
			{
				dirs = Directory.GetDirectories((string)item.Tag);
			}
			catch
			{
				return;
			}

			foreach (var dir in dirs)
			{
				TreeViewItem subItem = new TreeViewItem();
				subItem.Header = "[" + new DirectoryInfo(dir).Name + "]";
				subItem.Tag = dir;
				try
				{
					if (Directory.GetDirectories(dir).Length > 0 ||
						Directory.GetFiles(dir).Length > 0)
					{
						subItem.Items.Add(null);
					}
				}
				catch { }
				subItem.Expanded += TreeViewItem_Expanded;
				item.Items.Add(subItem);
			}

			AddFileItems(item, (string)item.Tag);

		}

		void AddFileItems(TreeViewItem root, string directory)
		{
			foreach (var file in Directory.GetFiles(directory))
			{
				TreeViewItem subItem = new TreeViewItem();
				subItem.Header = new FileInfo(file).Name;
				subItem.Tag = file;
				if (subItem.Tag as string == SelectedPath)
				{
					subItem.IsSelected = true;
				}
				root.Items.Add(subItem);
			}
		}

		void TreeViewItem_Expanded(object sender, RoutedEventArgs e)
		{
			TreeViewItem rootItem = (TreeViewItem)sender;

			if (rootItem.Items.Count == 1 && rootItem.Items[0] == null)
			{
				FillItemByTag(rootItem);
			}
		}

		object CloneUsingXaml(object obj)
		{
			string xaml = XamlWriter.Save(obj);
			return XamlReader.Load(new XmlTextReader(new StringReader(xaml)));
		}

		// Xaml 에서 마우스로 다른 path 를 클릭했을 때
		private void treeView_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
		{
			TreeViewItem selected_item = (TreeViewItem)e.NewValue;
			if (selected_item == null)
			{
				return;
			}
			SelectedPath = selected_item.Tag as string;

			GetViewModel().RefreshHistory(SelectedPath);
		}

	}
}
