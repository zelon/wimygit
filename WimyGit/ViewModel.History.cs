using System;
using System.ComponentModel;

namespace WimyGit
{
  partial class ViewModel
  {
    private void InitializeHistory()
    {
      HistoryList = new System.Collections.ObjectModel.ObservableCollection<HistoryStatus>();
    }

    public class HistoryStatus
    {
      public string CommitId { get; set; }
      public string Author { get; set; }
      public string Comment { get; set; }
      public string Display { get; set; }
      public bool IsSelected { get; set; }
    }

    public System.Collections.ObjectModel.ObservableCollection<HistoryStatus> HistoryList { get; set; }
    
    void RefreshHistory()
    {
      HistoryList.Clear();

      var commits = git_.GetHistory();

      Int32 max_count = 20;
      Int32 count = 0;
      foreach (var commit in commits)
      {
        HistoryStatus status = new HistoryStatus();
        status.CommitId = commit.Id.ToString().Substring(0, 7);
        status.Author = commit.Author.ToString();
        status.Comment = commit.MessageShort;
        status.Display = String.Format("Commit id: {0}\n\n{1}", commit.Id.ToString(), commit.Message);
        status.IsSelected = false;

        HistoryList.Add(status);
        ++count;
        if (count > max_count)
        {
          break;
        }
      }

      PropertyChanged(this, new PropertyChangedEventArgs("HistoryList"));
    }
  }
}
