using System;
using System.Globalization;
using System.Windows.Data;

namespace WimyGit.UserControls
{
    public class BoolToStringConverter : IValueConverter
    {
        public BoolToStringConverter()
        {
            TrueString = "True";
            FalseString = "False";
        }

        public string TrueString { get; set; }
        public string FalseString { get; set; }

        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if ((bool)value)
            {
                return TrueString;
            }
            return FalseString;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
