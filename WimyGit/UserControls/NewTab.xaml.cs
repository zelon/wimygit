using System;
using System.Windows.Controls;

namespace WimyGit.UserControls
{
    /// <summary>
    /// Interaction logic for NewTab.xaml
    /// </summary>
    public partial class NewTab : UserControl
    {
        public NewTab(Action<string> new_tab_result)
        {
            InitializeComponent();

            DataContext = new NewTabViewModel(new_tab_result);
        }
    }
}
