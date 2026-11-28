namespace CrucibleAI.Verdicts;

internal static class Binomial
{
    private const int SearchSteps = 100;

    public static double Below(int k, int n, double p)
    {
        if (p <= 0)
        {
            return k > 0 ? 1 : 0;
        }
        if (p >= 1)
        {
            return k > n ? 1 : 0;
        }
        var odds = Math.Log(p) - double.LogP1(-p);
        var logTerm = n * double.LogP1(-p);
        var total = 0.0;
        for (var i = 0; i < k; i++)
        {
            total += Math.Exp(logTerm);
            logTerm += Math.Log(n - i) - Math.Log(i + 1) + odds;
        }
        return Math.Min(1, total);
    }

    public static double AtLeast(int x, int n, double p) => 1 - Below(x, n, p);

    public static double AtMost(int x, int n, double p) => Below(x + 1, n, p);

    public static double Rising(Func<double, double> tail, double target) => Search(p => tail(p) < target);

    public static double Falling(Func<double, double> tail, double target) => Search(p => tail(p) > target);

    private static double Search(Func<double, bool> belowRoot)
    {
        var low = 0.0;
        var high = 1.0;
        for (var step = 0; step < SearchSteps; step++)
        {
            var middle = (low + high) / 2;
            if (belowRoot(middle))
            {
                low = middle;
            }
            else
            {
                high = middle;
            }
        }
        return (low + high) / 2;
    }
}
