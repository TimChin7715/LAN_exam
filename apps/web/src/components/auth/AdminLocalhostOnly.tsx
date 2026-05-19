export function AdminLocalhostOnly() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 text-center">
      <h1 className="text-xl font-semibold text-foreground">考试管理台</h1>
      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        教官端仅可在安装本系统的管理机上使用。请在本机通过桌面快捷方式打开
        <span className="font-mono text-foreground"> http://127.0.0.1:5180/admin </span>
        。
      </p>
    </div>
  );
}
