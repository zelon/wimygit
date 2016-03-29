using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Controls.Primitives;

using System.Diagnostics;
using System.IO;
using System.Windows.Markup;
using System.Windows.Threading;
using System.Xml;


namespace WimyGit
{
  /// <summary>
  /// Interaction logic for MainWindow.xaml
  /// </summary>
  public partial class MainWindow : Window
  {
    public MainWindow()
    {
      InitializeComponent();

      this.DataContext = new ViewModel();
    }

    private void Window_Loaded(object sender, RoutedEventArgs e)
    {
      Service.GetInstance().SetWindow(this);

      GetViewModel().OnChangeDirectory(null);
    }

    private void TextBox_TextChanged(object sender, TextChangedEventArgs e)
    {
      TextBox textbox = (TextBox)sender;
      textbox.ScrollToEnd();
    }

    private ViewModel GetViewModel()
    {
      return (ViewModel)this.DataContext;
    }

    private void HistoryList_ScrollChanged(object sender, RoutedEventArgs e)
    {
      List<ScrollBar> scrollBarList = GetVisualChildCollection<ScrollBar>(sender);
      foreach (ScrollBar scrollBar in scrollBarList)
      {
        if (scrollBar.Orientation == Orientation.Vertical)
        {
          if (scrollBar.Maximum > 0 && scrollBar.Value == scrollBar.Maximum)
          {
            GetViewModel().MoreHistoryCommand.Execute(sender);
          }
        }
      }
    }

    // http://stackoverflow.com/questions/4139341/wpf-listbox-onscroll-event
    public static List<T> GetVisualChildCollection<T>(object parent) where T : Visual
    {
      List<T> visualCollection = new List<T>();
      GetVisualChildCollection(parent as DependencyObject, visualCollection);
      return visualCollection;
    }
    private static void GetVisualChildCollection<T>(DependencyObject parent, List<T> visualCollection) where T : Visual
    {
      int count = VisualTreeHelper.GetChildrenCount(parent);
      for (int i = 0; i < count; i++)
      {
        DependencyObject child = VisualTreeHelper.GetChild(parent, i);
        if (child is T)
        {
          visualCollection.Add(child as T);
        }
        else if (child != null)
        {
          GetVisualChildCollection(child, visualCollection);
        }
      }
    }

    #region TreeView Control
    // https://code.msdn.microsoft.com/windowsdesktop/File-system-TreeView-72549a6f
    private string RootPath { get; set; }
    public void SetRootPath(string directory)
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
      /// Update open directories every 5 second
      DispatcherTimer timer = new DispatcherTimer(TimeSpan.FromSeconds(5),
          DispatcherPriority.Background, TreeView_Update, Dispatcher);
    }
    void TreeView_Update(object sender, EventArgs e)
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
        if (newDrive.Items.Contains(null))
          /// Find relative old item for newDrive
          foreach (TreeViewItem oldDrive in oldComputerItem.Items)
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
          if (Directory.GetDirectories(directory).Length > 0)
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
            if (Directory.GetDirectories(dir).Length > 0)
              subItem.Items.Add(null);
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
    string SelectedPath { get; set; }
    #endregion

    object CloneUsingXaml(object obj)
    {
      string xaml = XamlWriter.Save(obj);
      return XamlReader.Load(new XmlTextReader(new StringReader(xaml)));
    }

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
