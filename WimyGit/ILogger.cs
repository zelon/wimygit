
namespace WimyGit
{
	public interface ILogger
	{
		void AddLog(string msg);
		void AddLog(System.Collections.Generic.List<string> msgs);
	}
}
