#nullable enable
using System;

namespace WimyGit
{
	public class DelegateCommand : System.Windows.Input.ICommand
	{
		private readonly Action<object> execute_;
		private readonly Predicate<object>? can_execute_;
		public event EventHandler? CanExecuteChanged;

		public DelegateCommand(Action<object> executeMethod, Predicate<object>? canExecuteMethod = null)
		{
			execute_ = executeMethod;
			can_execute_ = canExecuteMethod;
		}

		public void Execute(object parameter)
		{
			execute_(parameter);
		}

		public bool CanExecute(object parameter)
		{
			if (can_execute_ == null)
			{
				return true;
			}
			return can_execute_(parameter);
		}

		public void RaiseCanExecuteChanged()
		{
            CanExecuteChanged?.Invoke(this, EventArgs.Empty);
        }
	}
}
