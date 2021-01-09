using System.Collections.Generic;

namespace WimyGit.Plugin
{
    public class PluginArgument
    {
        public enum Type
        {
            String,
            Inputbox,
            RepositoryDirectory
        }

        public PluginArgument(Type type, string value)
        {
            _type = type;
            _value = value;
        }

        public Type type() { return _type; }
        public string value() { return _value; }

        private Type _type;
        private string _value;

        public static string ToArgumentString(List<PluginArgument> pluginArguments, string gitRepositoryPath)
        {
            string output = "";
            foreach (PluginArgument argument in pluginArguments)
            {
                string thisArgument = "";
                switch (argument.type())
                {
                    case Type.String:
                        thisArgument = argument.value();
                        break;
                    case Type.RepositoryDirectory:
                        string value = System.IO.Path.Combine(gitRepositoryPath, argument.value());
                        thisArgument = $"\"{value}\"";
                        break;
                }
                if (thisArgument.Length > 0)
                {
                    if (output.Length > 0)
                    {
                        output += " ";
                    }
                    output += thisArgument;
                }
            }
            return output;
        }
    }
}
