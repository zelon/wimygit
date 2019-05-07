using System;
using System.Collections.Generic;
using System.Globalization;
using System.Windows.Data;
using WimyGit.ViewModels;

namespace WimyGit
{
    public class CommitIdToFileListConverter : IMultiValueConverter
    {
        public CommitIdToFileListConverter()
        {
        }

        public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
        {
            if (values[0] is HistoryTabViewModel == false)
            {
                return null;
            }
            HistoryTabViewModel historyTabViewModel = (HistoryTabViewModel)values[0];
            HistoryTabViewModel.HistoryStatus historyStatus = (HistoryTabViewModel.HistoryStatus)values[1];

            if (historyStatus == null)
            {
                return null;
            }
            string commitId = historyStatus.CommitId;
            if (string.IsNullOrEmpty(commitId))
            {
                return null;
            }
            List<HistoryFile> output = new List<HistoryFile>();
            foreach (var file_info in historyTabViewModel.GitWrapper.GetFilelistOfCommit(commitId))
            {
                HistoryFile file = new HistoryFile();
                file.CommitId = commitId;
                file.Status = file_info.Status;
                file.FileName = file_info.FileName;
                file.FileName2 = file_info.FileName2;
                file.Display = file.FileName;
                if (string.IsNullOrEmpty(file.FileName2) == false)
                {
                    file.Display += " -> " + file.FileName2;
                }
                output.Add(file);
            }
            return output;
        }

        public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }

    public class HistoryFile
    {
        public string CommitId { get; set; }
        public string Status { get; set; }
        public string Display { get; set; }
        public string FileName { get; set; }
        public string FileName2 { get; set; }
    }
}
