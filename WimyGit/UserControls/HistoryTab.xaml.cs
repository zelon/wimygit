using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Controls.Primitives;

namespace WimyGit.UserControls
{
    public partial class HistoryTab : UserControl
    {
        public HistoryTab()
        {
            InitializeComponent();
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
                        ViewModel viewModel = (ViewModel)DataContext;
                        if (viewModel.MoreHistoryCommand.CanExecute(sender))
                        {
                            viewModel.MoreHistoryCommand.Execute(sender);
                        }
                        return;
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
