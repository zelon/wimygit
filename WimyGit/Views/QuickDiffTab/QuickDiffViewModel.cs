using System;
using System.Collections.Generic;
using System.Windows.Controls;
using WimyGit.Service;

namespace WimyGit.ViewModels
{
    public class QuickDiffViewModel : NotifyBase
    {
        private TabControl _currentTabControl;
        private QuickDiffBuilder _currentBuilder;

        public void SetContentBuilder(TabControl tabControl, QuickDiffBuilder builder)
        {
            _currentTabControl = tabControl;
            _currentBuilder = builder;

            tabControl.Items.Clear();

            List<QuickDiffContentInfo> quickDiffContentInfos = builder.Build();

            bool isFirst = true;
            int index = 0;
            foreach (var quickDiffContentInfo in quickDiffContentInfos)
            {
                var quickDiffUnitView = new Views.QuickDiffTab.QuickDiffUnit();
                var quickDiffUnitViewModel = new Views.QuickDiffTab.QuickDiffUnitViewModel(
                    quickDiffUnitView.RichOutput,
                    onMoreContext: () => { builder.ContextLines += 3; Rebuild(); },
                    onLessContext: () => { builder.ContextLines = Math.Max(0, builder.ContextLines - 3); Rebuild(); });
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

        private void Rebuild()
        {
            SetContentBuilder(_currentTabControl, _currentBuilder);
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
