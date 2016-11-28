using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WimyGit
{
    class Service
    {
        private static Service instance_ = null;
        private MainWindow window_ = null;

        public static Service GetInstance()
        {
            if (instance_ == null)
            {
                instance_ = new Service();
            }
            return instance_;
        }

        private Service()
        {

        }

        public void SetWindow(MainWindow window)
        {
            window_ = window;
        }

        public void ShowMsg(string msg)
        {
            System.Windows.MessageBox.Show(window_, msg);
        }

        public System.Windows.MessageBoxResult ConfirmMsg(string msg, string caption)
        {
            return System.Windows.MessageBox.Show(msg, caption, System.Windows.MessageBoxButton.OKCancel);
        }

        public void SetRootPath(string directory)
        {
            window_.SetRootPath(directory);
        }

        public void RefreshDirectoryTree()
        {
            window_.TreeView_Update(null, null);
        }
    }
}
