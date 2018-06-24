using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;

namespace WimyGit
{
    /// <summary>
    /// Interaction logic for RepositoryTab.xaml
    /// </summary>
    public partial class RepositoryTab : UserControl
    {
        private string git_repository_path_;

        public RepositoryTab(string git_repository_path)
        {
            git_repository_path_ = git_repository_path;

            InitializeComponent();

            DataContext = new ViewModel(git_repository_path, this);
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            GetViewModel().Refresh();

            SetTreeViewRootPath(git_repository_path_);
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
    }
}
