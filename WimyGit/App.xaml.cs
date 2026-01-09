using System;
using System.Windows;
using Backtrace;
using Backtrace.Model;

namespace WimyGit
{
    public partial class App : Application
    {
        private BacktraceClient backtraceClient;
        internal static string CommandLineDirectory { get; private set; }

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);

            // Backtrace 초기화
            var credentials = new BacktraceCredentials(
                @"https://submit.backtrace.io/wimy/27b04c05a71915cd9a18efa0821f447d46add4f9f8f8d6d3736ff08a82376794/json"
            );

            var configuration = new BacktraceClientConfiguration(credentials)
            {
                ReportPerMin = 10 // 분당 최대 10개 리포트
            };

            backtraceClient = new BacktraceClient(configuration);

            // 전역 예외 처리 설정
            AppDomain.CurrentDomain.UnhandledException += OnUnhandledException;
            DispatcherUnhandledException += OnDispatcherUnhandledException;

            // 명령줄 인자 처리
            if (e.Args.Length > 0)
            {
                string directory = e.Args[0];

                // Git 디렉토리 유효성 검사
                if (Util.IsValidGitDirectory(directory))
                {
                    CommandLineDirectory = directory;
                }
                else
                {
                    MessageBox.Show(
                        $"'{directory}' is not a valid Git repository.",
                        "WimyGit",
                        MessageBoxButton.OK,
                        MessageBoxImage.Warning
                    );
                }
            }
        }

        private void OnUnhandledException(object sender, UnhandledExceptionEventArgs e)
        {
            var exception = e.ExceptionObject as Exception;
            if (exception != null)
            {
                var report = new BacktraceReport(exception);
                backtraceClient?.Send(report);
            }
        }

        private void OnDispatcherUnhandledException(object sender, System.Windows.Threading.DispatcherUnhandledExceptionEventArgs e)
        {
            var report = new BacktraceReport(e.Exception);
            backtraceClient?.Send(report);

            // 예외를 처리했음을 표시 (애플리케이션이 종료되지 않도록)
            // 필요에 따라 이 줄을 제거할 수 있습니다
            // e.Handled = true;
        }
    }
}
