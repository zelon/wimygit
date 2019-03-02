using System;
using System.Collections.Generic;
using System.Globalization;
using System.Windows.Data;

namespace WimyGit
{
    public class CommitIdToFileListConverter : IMultiValueConverter
    {
        public CommitIdToFileListConverter()
        {
        }

        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            if (values[0] is ViewModel == false)
            {
                return null;
            }
            ViewModel viewModel = (ViewModel)values[0];
            ViewModel.HistoryStatus historyStatus = (ViewModel.HistoryStatus)values[1];

            if (historyStatus == null)
            {
                return null;
            }
            string commitId = historyStatus.CommitId;
            if (string.IsNullOrEmpty(commitId))
            {
                return null;
            }
            List<ViewModel.HistoryFile> output = new List<ViewModel.HistoryFile>();
            foreach (var file_info in viewModel.git_.GetFilelistOfCommit(commitId))
            {
                ViewModel.HistoryFile file = new ViewModel.HistoryFile();
                file.Directory = file_info.FileName;
                file.Status = file_info.Status;
                file.FileName = file_info.FileName;
                file.FileName2 = file_info.FileName2;
                file.Display = file.FileName;
                if (string.IsNullOrEmpty(file.FileName2) == false)
                {
                    file.Display += " -> " + file.FileName2;
                }
                file.IsSelected = false;
                output.Add(file);
            }
            return output;
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
