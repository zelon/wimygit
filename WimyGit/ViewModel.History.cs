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
      public string LocalDateTime { get; set; }
      public string CommitId { get; set; }
      public string Sha { get; set; }
      public string Author { get; set; }
      public string Comment { get; set; }
      public string Message { get; set; }
      public string ListMessage { get; set; }
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
      AddHistoryFrom(HistoryList.Count);
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

    private string SelectedPath { get; set; }

    public void RefreshHistory(string selected_path)
    {
      HistoryList.Clear();

      SelectedPath = selected_path;
      AddHistoryFrom(/*skip_count=*/0);
    }

    void AddHistoryFrom(Int32 skip_count)
    {
      var commits = git_.GetHistory(skip_count, /*max_count=*/20);

      foreach (var commit in commits)
      {
        HistoryStatus status = new HistoryStatus();
        status.LocalDateTime = commit.LocalTimeDate;
        status.CommitId = commit.Sha.Substring(0, 7);
        status.Sha = commit.Sha;
        status.Author = commit.Author.ToString();
        status.Message = commit.Message;
        status.ListMessage = commit.RefNames + " " + status.Message;
        status.Comment = commit.Message;
        status.Detail = MakeDetail(commit);
        status.IsSelected = false;
        status.view_model_ = this;

        HistoryList.Add(status);
      }

      PropertyChanged(this, new PropertyChangedEventArgs("HistoryList"));
    }

    private string MakeDetail(CommitInfo commit)
    {
      var builder = new System.Text.StringBuilder();
      builder.Append("Author: " + commit.Author);
      builder.Append("\n");
      builder.Append("Date: " + commit.LocalTimeDate);
      builder.Append("\n");
      builder.Append("Commit Id: " + commit.Sha);
      builder.Append("\n");
      builder.Append(commit.Message.ToString());
      builder.Append("\n");
      return builder.ToString();
    }
  }
}
