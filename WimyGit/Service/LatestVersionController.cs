using System;
using System.Net.Http;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using System.Windows;

namespace WimyGit
{
	public class LatestVersionController
	{
        static readonly HttpClient httpClient = new HttpClient();

        public static async Task StartCheck(MainWindow mainWindow)
        {
            try
            {
                httpClient.DefaultRequestHeaders.Add("User-Agent", "WimyGitUpdateChecker");
                var response = await httpClient.GetAsync("https://api.github.com/repos/zelon/wimygit/releases/latest");
                response.EnsureSuccessStatusCode();
                var jsonBody = await response.Content.ReadAsStringAsync();

                JsonNode jsonNode = JsonNode.Parse(jsonBody);
                var browserDownloadUrl = jsonNode["assets"][0]["browser_download_url"].ToString();
                var parseResult = WimyGitLib.DownloadParser.GetVersionFromDownloadUrl(browserDownloadUrl);
                if (parseResult == null)
                {
                    throw new Exception("Cannot Parse version from github");
                }
                var latestVersion = parseResult.Version;
                var thisInstanceVersion = Util.GetVersion();
                if (latestVersion > thisInstanceVersion)
                {
                    var result = UIService.ShowMessageWithYesNo($"New version found! {thisInstanceVersion} -> {latestVersion}. Do you want to download?");
                    if (result == MessageBoxResult.No)
                    {
                        return;
                    }
                    mainWindow.IsEnabled = false;
                    var processDirectory = System.IO.Path.GetDirectoryName(Environment.ProcessPath);
                    string downloadFilePath = System.IO.Path.Combine(processDirectory, parseResult.DownloadFilename);

                    using var fileDownloadStream = await httpClient.GetStreamAsync(browserDownloadUrl);
                    using var fileWriteStream = System.IO.File.OpenWrite(downloadFilePath);
                    await fileDownloadStream.CopyToAsync(fileWriteStream);

                    mainWindow.IsEnabled = true;

                    var openExplorerResult = UIService.ShowMessageWithYesNo("Download completed. Do you want to open downloaded directory?");
                    if (openExplorerResult == MessageBoxResult.No)
                    {
                        return;
                    }
                    RunExternal runner = new RunExternal("explorer.exe", processDirectory);
                    runner.RunWithoutWaiting(processDirectory);
                }
                else
                {
                    UIService.ShowMessage($"Already up to date. Current Version is {thisInstanceVersion}");
                }
            }
            catch (Exception ex)
            {
                UIService.ShowMessage($"Cannot check latest release,exception:{ex.Message}");
            }
            finally
            {
                mainWindow.IsEnabled = true;
            }
        }
    }
}
