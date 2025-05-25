# Technical Documentation for Local Deployment of Large Models with Ollama and Integration with the read-frog Plugin

## I. Why This Is Necessary

### 1.1 Data Privacy Protection

When deploying large models locally using Ollama, data remains within the local environment and does not need to be uploaded to third-party servers as with cloud services. Sensitive data such as corporate financial records, R&D data, personal privacy information, and web browsing data are not at risk of interception, collection, or misuse by third parties during interaction with the large model. This fundamentally protects data privacy and avoids potential data leaks.

### 1.2 Enhanced Security

Local deployment of large models reduces interaction with external networks, lowering the risk of cyberattacks. Issues such as DDoS attacks and API key leaks that may occur with cloud services can be effectively avoided in a local deployment model. Additionally, the local environment allows for flexible implementation of strict access control and permission management policies according to enterprise or individual needs, further ensuring the security of large models and data.

### 1.3 Offline Usability

When in an environment with unstable network connectivity or network congestion, the locally deployed Ollama large model can still operate normally.

## II. Installing Ollama on Windows and Configuring Cross-Origin Support

### 2.1 Download the Installer

Visit the official Ollama website [here](https://ollama.ai/).

### 2.2 Execute the Installation

Do not double-click the downloaded `.exe` file to install (as it will default to installing on the C drive). Instead, open a command prompt window, drag the downloaded `.exe` file into the window, and run:

```bash
OllamaSetup.exe /DIR="D:\Your\Path"
```

to install it on another drive.

### 2.3 Configure Cross-Origin Support

Configure the following system environment variables:

- API service listening address: `OLLAMA_HOST=0.0.0.0`
- Allow cross-origin access: `OLLAMA_ORIGINS=*`
- Model file download location: `OLLAMA_MODELS=F:\ollama\models`
  (This is not related to cross-origin settings but is necessary because the default model download location is on the C drive, which may fill up your C drive. Manually specify the model storage path.)

Restart your computer after configuration.

## III. Common Commands for Using Ollama on Windows

### 3.1 Check Ollama Version

```bash
ollama version
```

This command checks the currently installed Ollama version to confirm successful installation and view version details.

### 3.2 Search for Available Models

```bash
ollama search [keyword]
```

Example: Search for models related to LLaMA:

```bash
ollama search llama
```

This command lists models matching the keyword, including model names and descriptions, to help users select the required model.

### 3.3 Pull a Model

```bash
ollama pull [model name]
```

Example: Pull the `llama2` model:

```bash
ollama pull llama2
```

After executing this command, Ollama downloads the specified model from the model repository to the local system for offline use.

### 3.4 Run a Model

```bash
ollama run [model name]
```

Example: Run the `llama2` model and interact with it:

```bash
ollama run llama2
```

After running, enter questions or commands in the command line, and the model will return corresponding responses. You can also add parameters during runtime to adjust model behavior, e.g.:

```bash
ollama run llama2 --system "You are a professional translator. Translate the user's input into English."
```

Use the `--system` parameter to set the model's role or task description.

### 3.5 Stop a Running Model

```bash
ollama stop [model name]
```

Example: Stop the running `llama2` model:

```bash
ollama stop llama2
```

This command closes the running model process and frees system resources.

### 3.6 List Downloaded Models

```bash
ollama list
```

This command displays all locally downloaded models, including names, sizes, and creation times, to help users manage local model resources.

### 3.7 Delete a Model

```bash
ollama delete [model name]
```

Example: Delete the unused `llama2` model:

```bash
ollama delete llama2
```

After execution, the model is removed from the local system, freeing disk space.

## IV. Recommendations for Using Ollama in the read-frog Plugin

### 4.1 Ollama API Key and Model Recommendations

- The default address for the locally deployed Ollama is `http://localhost:11434`. The API key can be arbitrary, but the model name must match exactly with the names listed by `ollama list`.
- Recommended model: `gemma3:1b` (815MB in size). Despite its small size, it is fully functional, performs well for translation, and has low system load (works with CPU). Avoid using inference models like `deepseek`, as they output inference processes (even after filtering), resulting in poor translation quality and speed.
- **Not recommended**: Using local models for the read-frog "read" function, as local models consume significant VRAM and RAM. Most locally deployed models have limited context window support. If the input content exceeds the model's context window limit, Ollama will truncate the input, but this still renders the "read" function ineffective.

### 4.2 Do you want to contribute to the Ollama functionality of read - frog?

- Please first read [here](https://readfrog.mengxi.work/en/tutorial/contribution).

- You can try to deploy various large models with tool support locally using Ollama to test the translation and reading functions of read - frog. Note that you need a good graphics card and large memory. Please be aware that some large models on Ollama do not support tools, and such models cannot complete the read - frog reading function.

- When you find a model that works well, you can copy its name and add it to the `ollama` field in `readProviderModels` or `translateProviderModels` in the `src/types/config/provider.ts` file. In this way, you can find this model in the model drop - down menu on the plugin settings page, which means you have added a model to the Ollama function of our read - frog.
