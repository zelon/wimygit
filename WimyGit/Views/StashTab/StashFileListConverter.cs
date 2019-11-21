using System;
using System.Diagnostics;
using System.Globalization;
using System.Windows.Data;
using WimyGit.UserControls;

namespace WimyGit
{
    public class StashFileListConverter : IMultiValueConverter
    {
        public StashFileListConverter()
        {
        }

        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            if (values[0] is StashTabViewModel == false)
            {
                Debug.Assert(false);
                return null;
            }
            StashTabViewModel stashTabViewModel = (StashTabViewModel)values[0];
            StashItem selectedStashItem = (StashItem)values[1];

            if (selectedStashItem == null)
            {
                return null;
            }
            string stashName = selectedStashItem.Name;
            if (string.IsNullOrEmpty(stashName))
            {
                return null;
            }
            if (stashTabViewModel._gitRepository.TryGetTarget(out IGitRepository gitRepository) == false)
            {
                System.Diagnostics.Debug.Assert(false);
                return null;
            }
            return gitRepository.GetGitWrapper().GetStashedFileInfos(stashName);
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
