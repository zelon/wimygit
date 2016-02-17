using System;
using System.ComponentModel;
using System.Windows.Input;
using LibGit2Sharp;

namespace WimyGit
{
  partial class ViewModel
  {
    private void InitializeHistory()
    {
      HistoryList = new System.Collections.ObjectModel.ObservableCollection<HistoryStatus>();
      HistoryFileList = new System.Collections.ObjectModel.ObservableCollection<HistoryFile>();

      HistorySelectedCommand = new DelegateCommand(OnHistorySelectedCommand);
      MoreHistoryCommand = new DelegateCommand(OnMoreHistoryCommand);
    }

    public class HistoryStatus
    {
      public string CommitId { get; set; }
      public string Sha { get; set; }
      public string Author { get; set; }
      public string Comment { get; set; }
      public string Message { get; set; }
      public string MessageShort { get; set; }
      public string Detail { get; set; }
      public bool IsSelected
      {
        get { return is_selected_; }
        set
        {
          if (is_selected_ == value)
          {
            return;
          }
          is_selected_ = value;

          if (is_selected_)
          {
            view_model_.OnHistorySelectedCommand(this);
          }
        }
      }
      private bool is_selected_ = false;
      public ViewModel view_model_;
    }

    public System.Collections.ObjectModel.ObservableCollection<HistoryStatus> HistoryList { get; set; }

    public class HistoryFile
    {
      public string FileName { get; set; }
      public string Directory { get; set; }
      public bool IsSelected { get; set; }
    }
    public System.Collections.ObjectModel.ObservableCollection<HistoryFile> HistoryFileList { get; set; }

    public ICommand MoreHistoryCommand { get; private set; }
    public void OnMoreHistoryCommand(object parameter)
    {
      if (HistoryList.Count == 0)
      {
        return;
      }
      AddHistoryFrom(HistoryList[HistoryList.Count - 1].Sha);
    }

    public ICommand HistorySelectedCommand { get; private set; }
    public void OnHistorySelectedCommand(object parameter)
    {
      HistoryStatus status = (HistoryStatus)parameter;
      HistoryDetail = status.Detail;

      HistoryFileList.Clear();
      foreach (var filename in git_.GetFilelistOfCommit(status.CommitId))
      {
        HistoryFile file = new HistoryFile();
        file.Directory = filename;
        file.FileName = filename;
        file.IsSelected = false;
        HistoryFileList.Add(file);
      }
      NotifyPropertyChanged("HistoryFileList");
    }

    private string history_detail_;
    public string HistoryDetail
    {
      get
      {
        return history_detail_;
      }
      set
      {
        history_detail_ = value;
        NotifyPropertyChanged("HistoryDetail");
      }
    }

    void RefreshHistory()
    {
      HistoryList.Clear();

      AddHistoryFrom(null);
    }

    void AddHistoryFrom(string sha)
    {
      // git log --graph --format="%ai_%t_%an_%d_%s"
      var commits = git_.GetHistory();

      Int32 max_count = 20;
      Int32 count = 0;
      foreach (var commit in commits)
      {
        if (sha != null)
        {
          if (commit.Sha != sha)
          {
            continue;
          }
          sha = null;
          continue;
        }
        HistoryStatus status = new HistoryStatus();
        status.CommitId = commit.Sha.Substring(0, 7);
        status.Sha = commit.Sha;
        status.Author = commit.Author.ToString();
        status.Message = commit.Message;
        status.MessageShort = commit.MessageShort;
        status.Comment = commit.MessageShort;
        status.Detail = MakeDetail(commit);
        status.IsSelected = false;
        status.view_model_ = this;

        HistoryList.Add(status);
        ++count;
        if (count > max_count)
        {
          break;
        }
      }

      PropertyChanged(this, new PropertyChangedEventArgs("HistoryList"));
    }

    private string MakeDetail(Commit commit)
    {
      var builder = new System.Text.StringBuilder();
      builder.Append("Author: " + commit.Author.ToString());
      builder.Append("\n");
      builder.Append("Date: " + commit.Author.When.ToString("yyyy MM dd HH:mm:ss"));
      builder.Append("\n");
      builder.Append("Commit Id: " + commit.Sha);
      builder.Append("\n");
      builder.Append(commit.Message.ToString());
      builder.Append("\n");
      return builder.ToString();
    }
  }
}
