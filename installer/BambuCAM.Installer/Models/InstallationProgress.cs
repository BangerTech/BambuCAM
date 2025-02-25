public class InstallationProgress
{
    public bool Success { get; }
    public string ErrorMessage { get; }

    private InstallationProgress(bool success, string errorMessage = null)
    {
        Success = success;
        ErrorMessage = errorMessage;
    }

    public static InstallationProgress Successful => new(true);
    public static InstallationProgress Failure(string message) => new(false, message);
} 