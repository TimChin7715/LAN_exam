using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Net.Sockets;
namespace LANExamTray;

internal static class Program
{
    private static readonly string InstallRoot = ResolveInstallRoot();
    private static NotifyIcon? _tray;
    private static HttpClient? _http;

    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };

        using var tray = CreateTrayIcon();
        _tray = tray;
        EnsureServicesRunning();
        Application.Run();
    }

    private static string ResolveInstallRoot()
    {
        var env = Environment.GetEnvironmentVariable("LAN_EXAM_HOME");
        if (!string.IsNullOrWhiteSpace(env))
        {
            return Path.GetFullPath(env);
        }

        var exeDir = AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        if (File.Exists(Path.Combine(exeDir, "start.bat")))
        {
            return exeDir;
        }

        return Path.GetFullPath(Path.Combine(exeDir, ".."));
    }

    private static NotifyIcon CreateTrayIcon()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("打开管理台", null, (_, _) => OpenAdmin());
        menu.Items.Add("复制学员地址", null, (_, _) => CopyStudentUrl());
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("退出系统", null, (_, _) => ExitSystem());

        var icon = new NotifyIcon
        {
            Text = "局域网考试系统",
            Icon = SystemIcons.Application,
            Visible = true,
            ContextMenuStrip = menu,
        };

        icon.DoubleClick += (_, _) => OpenAdmin();
        return icon;
    }

    private static void EnsureServicesRunning()
    {
        if (IsHealthy())
        {
            return;
        }

        RunBatch("start.bat", wait: false);
        WaitForHealth(TimeSpan.FromSeconds(90));
    }

    private static bool IsHealthy()
    {
        try
        {
            var response = _http!.GetAsync("http://127.0.0.1:5180/health").GetAwaiter().GetResult();
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private static void WaitForHealth(TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (IsHealthy())
            {
                return;
            }

            Thread.Sleep(1000);
        }
    }

    private static void OpenAdmin()
    {
        EnsureServicesRunning();
        Process.Start(new ProcessStartInfo
        {
            FileName = Path.Combine(InstallRoot, "open-admin.bat"),
            WorkingDirectory = InstallRoot,
            UseShellExecute = true,
        });
    }

    private static void CopyStudentUrl()
    {
        var ip = GetLanIPv4();
        var url = $"http://{ip}:5180/exam/login";
        Clipboard.SetText(url);
        _tray?.ShowBalloonTip(
            3000,
            "学员地址已复制",
            url,
            ToolTipIcon.Info);
    }

    private static string GetLanIPv4()
    {
        foreach (var address in Dns.GetHostAddresses(Dns.GetHostName()))
        {
            if (address.AddressFamily == AddressFamily.InterNetwork
                && !IPAddress.IsLoopback(address))
            {
                return address.ToString();
            }
        }

        return "127.0.0.1";
    }

    private static void ExitSystem()
    {
        var result = MessageBox.Show(
            "确定要退出局域网考试系统并停止后台服务吗？",
            "退出系统",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);
        if (result != DialogResult.Yes)
        {
            return;
        }

        RunBatch("stop.bat", wait: true);
        Application.Exit();
    }

    private static void RunBatch(string fileName, bool wait)
    {
        var path = Path.Combine(InstallRoot, fileName);
        if (!File.Exists(path))
        {
            MessageBox.Show($"未找到脚本：{path}", "LAN Exam", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        var psi = new ProcessStartInfo
        {
            FileName = "cmd.exe",
            Arguments = $"/c \"{path}\"",
            WorkingDirectory = InstallRoot,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        var process = Process.Start(psi);
        if (wait && process != null)
        {
            process.WaitForExit(120_000);
        }
    }
}
