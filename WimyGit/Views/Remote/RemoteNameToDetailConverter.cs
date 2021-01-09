using System;
using System.Collections.Generic;
using System.Globalization;
using System.Windows.Data;
using WimyGitLib;

namespace WimyGit.UserControls
{
    public class RemoteNameToDetailConverter : IMultiValueConverter
    {
        public RemoteNameToDetailConverter()
        {
        }

        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            if (values == null)
            {
                return "";
            }
            RemoteTabViewModel remoteTabViewModel = (RemoteTabViewModel)values[0];
            RemoteInfo selectedRemoteInfo = (RemoteInfo)values[1];
            if (selectedRemoteInfo == null)
            {
                return "";
            }
            string cmd = GitCommandCreator.GetRemoteDetail(selectedRemoteInfo.Name);
            List<string> lines = remoteTabViewModel.GitRepo.CreateGitRunner().Run(cmd);

            return string.Join(Environment.NewLine, lines);
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
