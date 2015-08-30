using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace WimyGit
{
    partial class ViewModel
    {
        enum LastFocusedList
        {
            kNone,
            kModifiedList,
            kStagedList,
        }
        private LastFocusedList last_focused_list_ = LastFocusedList.kNone;

        public void LostFocus_FromLists()
        {
            last_focused_list_ = LastFocusedList.kNone;
        }
        public void ModifiedList_GotFocus()
        {
            last_focused_list_ = LastFocusedList.kModifiedList;
        }
        public void StagedList_GotFocus()
        {
            last_focused_list_ = LastFocusedList.kStagedList;
        }
    }
}
