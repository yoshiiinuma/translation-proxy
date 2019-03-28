# translation-proxy

Translation-Proxy translates the contents from the origin by using Google Cloud Translation API when requested.

     
## Requirements

- redis
- Node.js
- Google Cloud SDK
- Your Google Cloud Service Account and API Key
- Your SSL Cert and Key

     
## Installation

```sh
$ npm install translation-proxy
$ cd translation-proxy
$ npm install
$ npm run build 
```

     
## Google Service Account and API Key Setup

1. Log in to [Google Cloud Platform Console](https://console.cloud.google.com).

2. Create a service account on your project on GCP.
  
  GCP > IAM & admin > Service accounts

3. Create Service Account key for the account on GCP and download the key (json).

  GCP > APIs & Services > Credentials

4. Move the API key on the machine where you intalled the proxy server.

4. Activate service account with SDK.

  $ gcloud auth activate-service-account --key-file your-key.json

5. Set the API KEY path to Environmental Variable: GOOGLE_APPLICATION_CREDENTIALS

  ```sh
  $ export GOOGLE_APPLICATION_CREDENTIALS="path/to/your-key.json"
  ```

6. Test your Service Account API Key

  ```sh
  $ gcloud auth application-default print-access-token
  ```

     
## Test

```sh
$ npm run test
```

     
## Usage

```sh
$ sudo node dist/server.js
```

     
## Configuration

copy config/sample.json and create config/config.json and modify it.

     
### Sample Configuration JSON

```json
{
  "cacheEnabled": true,
  "cacheSkipUrls": ["do-not-cache-if-requested-url-contains-keyword"],
  "cacheSkipCookies": ["do-not-cache-if-request-contains-cookie"],
  "cacheShortTTL": 60,
  "cacheTTL": [
      { "type": "text/html",       "ttl":  86400 },
      { "type": "text/css",        "ttl": 259200 },
      { "type": "text",            "ttl": 604800 },
      { "type": "application/pdf", "ttl": 604800 },
      { "type": "application",     "ttl": 259200 },
      { "type": "image",           "ttl": 604800 },
      { "type": "default",         "ttl": 604800 }
  ],
  "proxiedHosts": ["your.domain.com"],
  "purgeAllowedIps": ["127.0.0.1"],
  "translationSelectors": ["#header", "#main", "#footer"],
  "maxPageSize": 80000,
  "maxTextPerRequest": 12000,
  "domBreakdownThreshold": 250,
  "keyPath": "/path/to/key.json",
  "gcloudPath": "/path/to/google-cloud-sdk/bin/gcloud",
  "serverHttpPort": 80,
  "serverHttpsPort": 443,
  "targetHttpPort": 80,
  "targetHttpsPort": 443,
  "sslCert": "./certs/test.pem",
  "sslKey": "./certs/test.key",
  "redisHost": "127.0.0.1",
  "redisPort": 6379,
  "enableLog": true,
  "logLevel": "debug",
  "logDir": "./logs"
}
```

     
### Sample For Wordpress Origin

```
{
  ...
  "cacheSkipUrls": ["wp-admin", "wp-login", "wp-cron.php"],
  "cacheSkipCookies": ["wordpress_logged_in", "resetpass"],
  ...
}

```

     
### Configuration Options

     
#### Cache Related

| Option | Description |
| ------ | ----------- | 
| cacheEnabled | Enable cache if true. |
| cacheSkipUrls | Bypass cach if the requested url containes one of the specified keywords. |
| cacheSkipCookies | Bypass cach if the request containes one of the specified cookies. |
| cacheShortTTL | Cache TTL (in seconds) for 302 (Moved Temporarily), 307 (Temporary Redirect), 500 (Internal Sever Error), 503 (Service Not Available) responses; default 60 secs. |
| cacheTTL | Cache TTL (in seconds) per matched Content Type; Array of { "type", "ttl" } |
| redisHost | Redis Host; default localhost |
| redisPort | Redis Port; default 6379 |
| purgeAllowedIps | Allow specified IP addresses to send a cache purge request. |

     
#### Translation Related

| Option | Description |
| ------ | ----------- | 
| translationSelectors | DOM selectors which specify where to be translated; eg. 'body', 'div#main' |
| maxPageSize | Not allow the page to be translated if the total text size exceeds this limit (in character); default 50,000 characters. |
| maxTextPerRequest |  Max text size (in character) per API request. |
| domBreakdownThreshold | If the size of a DOM component is larger than this threshold, the parser goes down into its children to break down the text when it creates API requests. |
| gcloudPath | The Google Cloud SDK installation path. |
| keyPath | The path to API Key. |

     
#### Server Related

| Option | Description |
| ------ | ----------- | 
| proxiedHosts | Allow the proxy to send a request only to hosts specified this. The proxy returns Bad Request when unspecified host is requested. |
| serverHttpPort | HTTP Port on which the proxy server listens. |
| serverHttpsPort | HTTPS Port on which the proxy server listens. |
| targetHttpPort | HTTP Port on which the origin web servers listen. |
| targetHttpsPort | HTTPS Port on which the origin web servers listen. |
| sslCert | The path to your SSL cert. |
| sslKey | The path to your SSL key. |

     
#### Logging Related

| Option | Description |
| ------ | ----------- | 
| enableLog | Enable Logging if true. |
| logLevel | Logging Level: (DEBUG\|INFO\|WARN\|ERROR\|FATAL) |
| logDir | Log file destination directory; default ./logs |
| logFile | Application log file name; default application.log |
| accessLogFile | Access log file name; default access.log |

     
## Caching

The proxy caches every response from the origin server when caching is enabled and the following conditions are satisfied:

- HTTP Request Method is:

  - GET or HEAD


- HTTP Response Code is:

  - 200 (OK)
  - 203 (Non Authoritative Information)
  - 204 (No Content)
  - 206 (Partial Content)
  - 300 (Multiple Choices)
  - 301 (Moved Permanently)
  - 302 (Found (Moved Temporarily))
  - 307 (Temporary Redirect)
  - 308 (Permanent Redirect)
  - 404 (Not Found)
  - 405 (Method Not Allowed)
  - 410 (Gone)
  - 414 (URL Too Long)
  - 500 (Internal Server Error)
  - 501 (Not Implemented)
  - 503 (Service Not Available)


***NOTE:***
  - You can bypass caching by configuring ***cachieSkipUrls*** or ***cacheSkipCookies*** options.
  - You can configure cache TTL per content type with ***cacheTTL*** option.
  - When the response code is 302, 307, 500, or 503, cache should expire in shorter period. You can specify it with ***cacheShortTTL*** option.  

     
## Purge Cache

There are two ways to purge cache:

1. purge a cached page
2. purge all the cache

For purging a cached resource, send a HTTP PURGE request to the URL which you want to purge.
For purging all the cache, send a HTTP PURGE request to /purge-proxy-cache?page=all.

***NOTE:***
  - You must specify ***purgeAllowedIps*** to send a purge request.

     
## Wordpress Plugin

- There is a wordpress plugin called [wp-translation-proxy-plugin](https://github.com/yoshiiinuma/wp-translation-proxy-plugin).
  It automatically sends a cache purge request to the proxy when page/post/attachment/theme is updated. However, its some features work only for a specific Wordpress theme for now.
     
## Proxy Server Management with PM2

I would recommend pm2.

```sh
$ npm install -g pm2
$ pm2 start dist/server.js
```

