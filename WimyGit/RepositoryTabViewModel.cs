using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WimyGit
{
    class RepositoryTabViewModel
    {
        public DelegateCommand ShowCommand { get; private set; }
        private long _my_value;

        public RepositoryTabViewModel()
        {
            _my_value = new Random().Next();
            ShowCommand = new DelegateCommand(obj =>
            {
                System.Diagnostics.Debug.WriteLine("MyValue: " + _my_value.ToString());
            });
        }
    }
}
