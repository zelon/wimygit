using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WimyGit
{
    partial class ViewModel
    {
        void RefreshHistory()
        {
            git_.GetHistory();
        }
    }
}
