using System.Collections.Generic;
using System.Windows.Controls;
using WimyGit.Service;

namespace WimyGit.ViewModels
{
    public class QuickDiffViewModel : NotifyBase
    {
        public void SetContentBuilder(TabControl tabControl, QuickDiffBuilder builder)
        {
            tabControl.Items.Clear();

            List<QuickDiffContentInfo> quickDiffContentInfos = builder.Build();

            bool isFirst = true;
            int index = 0;
            foreach (var quickDiffContentInfo in quickDiffContentInfos)
            {
                var quickDiffUnitView = new Views.QuickDiffTab.QuickDiffUnit();
                var quickDiffUnitViewModel = new Views.QuickDiffTab.QuickDiffUnitViewModel(quickDiffUnitView.RichOutput);
                TabItem basicDiffTabItem = new TabItem();
                basicDiffTabItem.Header = SelectTabHeader(index, quickDiffContentInfos);
                basicDiffTabItem.Content = quickDiffUnitView;
                basicDiffTabItem.DataContext = quickDiffUnitViewModel;

                tabControl.Items.Add(basicDiffTabItem);

                basicDiffTabItem.IsSelected = isFirst;
                if (isFirst)
                {
                    isFirst = false;
                }

                quickDiffUnitViewModel.SetContentBuilder(quickDiffContentInfo);

                ++index;
            }
        }

        private string SelectTabHeader(int index, List<QuickDiffContentInfo> quickDiffContentInfos)
        {
            if (quickDiffContentInfos.Count == 1)
            {
                return "Diff";
            }
            if (index == 0)
            {
                return "Combined Diff";
            }
            return $"Diff ^{index}";
        }
    }
}
