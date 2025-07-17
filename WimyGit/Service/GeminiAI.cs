using System.Collections.Generic;
using System.Net.Http;
using System;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace TestCSharp
{
    public class GeminiAI
    {
        private static readonly HttpClient httpClient = new HttpClient();
        private const string ModelId = "gemini-2.0-flash-lite";
        private const string GenerateContentApi = "streamGenerateContent"; // or "generateContent" (not streaming)

        private readonly string _apiKey;
        private readonly string _systemInstruction;

        public GeminiAI(string apiKey, string systemInstruction)
        {
            _apiKey = apiKey;
            _systemInstruction = systemInstruction;
        }

        public async Task<string> GetGeminiAIResponse(string input)
        {
            if (string.IsNullOrEmpty(_apiKey))
            {
                Console.WriteLine("Invalid GEMINI_API_KEY");
                return "";
            }

            // make request body
            var requestPayload = new GeminiRequest
            {
                Contents = new List<Content>
            {
                new Content
                {
                    Role = "user",
                    Parts = new List<Part>
                    {
                        new Part { Text = _systemInstruction }
                    }
                },
                new Content
                {
                    Role = "user",
                    Parts = new List<Part>
                    {
                        new Part { Text = input }
                    }
                }
            },
                GenerationConfig = new GenerationConfig
                {
                    Temperature = 0.3,
                    ResponseMimeType = "text/plain"
                }
            };

            // serialize to JSON
            string jsonPayload = JsonSerializer.Serialize(requestPayload, new JsonSerializerOptions
            {
                WriteIndented = true,
            });

            string apiUrl = $"https://generativelanguage.googleapis.com/v1beta/models/{ModelId}:{GenerateContentApi}?key={_apiKey}";

            try
            {
                StringBuilder stringBuilder = new StringBuilder();
                // make HTTP request message
                var requestMessage = new HttpRequestMessage(HttpMethod.Post, apiUrl);
                requestMessage.Content = new StringContent(jsonPayload, Encoding.UTF8, "application/json");

                Console.WriteLine($"\n--- sending API request: {apiUrl} ---");

                // send request and get response
                HttpResponseMessage response = await httpClient.SendAsync(requestMessage);

                // getting response content
                string responseBody = await response.Content.ReadAsStringAsync();

                Console.WriteLine($"\n--- API response (status code: {response.StatusCode}) ---");
                if (response.IsSuccessStatusCode)
                {
                    Console.WriteLine(responseBody);

                    System.Text.Json.Nodes.JsonNode? jsonNode = System.Text.Json.Nodes.JsonNode.Parse(responseBody);
                    if (jsonNode == null)
                    {
                        Console.WriteLine("JSON parse error: returning empty");
                        return "";
                    }
                    foreach (var item in jsonNode.AsArray())
                    {
                        if (item == null)
                        {
                            continue;
                        }
                        var candidates = item["candidates"];
                        if (candidates != null)
                        {
                            foreach (var candidate in candidates.AsArray())
                            {
                                if (candidate == null)
                                {
                                    continue;
                                }
                                var content = candidate["content"];
                                if (content != null)
                                {
                                    var parts = content["parts"];
                                    if (parts != null)
                                    {
                                        foreach (var part in parts.AsArray())
                                        {
                                            if (part == null)
                                            {
                                                continue;
                                            }
                                            stringBuilder.Append(part["text"]);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                else
                {
                    Console.WriteLine("Error occured:");
                    Console.WriteLine(responseBody);
                }

                return stringBuilder.ToString();
            }
            catch (HttpRequestException e)
            {
                Console.WriteLine($"\nHTTP request error: {e.Message}");
            }
            catch (JsonException e)
            {
                Console.WriteLine($"\nJSON serialization/deserialization error: {e.Message}");
            }
            catch (Exception e)
            {
                Console.WriteLine($"\nUnknown error: {e.Message}");
            }
            return "";
        }
    }

    public class Part
    {
        [JsonPropertyName("text")]
        public string Text { get; set; } = "";
    }

    public class Content
    {
        [JsonPropertyName("role")]
        public string Role { get; set; } = "";

        [JsonPropertyName("parts")]
        public List<Part> Parts { get; set; } = new List<Part>();
    }

    public class GenerationConfig
    {
        [JsonPropertyName("temperature")]
        public double Temperature { get; set; }

        [JsonPropertyName("responseMimeType")]
        public string ResponseMimeType { get; set; } = "";
    }

    public class GeminiRequest
    {
        [JsonPropertyName("contents")]
        public List<Content> Contents { get; set; } = new List<Content>();

        [JsonPropertyName("generationConfig")]
        public GenerationConfig GenerationConfig { get; set; } = new GenerationConfig();
    }
}
