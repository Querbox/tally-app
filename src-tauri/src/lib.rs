use serde::{Deserialize, Serialize};

const GITHUB_TOKEN: &str = env!("TALLY_GITHUB_TOKEN");
const GITHUB_REPO: &str = "Querbox/tally-app";

#[derive(Debug, Serialize, Deserialize)]
struct GitHubIssueRequest {
    title: String,
    body: String,
    labels: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct GitHubIssueResponse {
    number: u64,
    html_url: String,
}

#[derive(Debug, Serialize)]
struct FeedbackResult {
    success: bool,
    issue_number: Option<u64>,
    issue_url: Option<String>,
    error: Option<String>,
}

#[tauri::command]
async fn submit_feedback(
    feedback_type: String,
    title: String,
    description: String,
    app_version: String,
) -> Result<FeedbackResult, String> {
    let title = title.trim().to_string();
    let description = description.trim().to_string();

    if title.is_empty() {
        return Ok(FeedbackResult {
            success: false,
            issue_number: None,
            issue_url: None,
            error: Some("Titel darf nicht leer sein".to_string()),
        });
    }

    let labels = match feedback_type.as_str() {
        "feature" => vec!["enhancement".to_string(), "from-app".to_string()],
        "bug" => vec!["bug".to_string(), "from-app".to_string()],
        "feedback" => vec!["feedback".to_string(), "from-app".to_string()],
        _ => vec!["from-app".to_string()],
    };

    let body = format!(
        "{}\n\n---\n*Gesendet aus Tally v{} via In-App Feedback*",
        description, app_version
    );

    let issue = GitHubIssueRequest {
        title,
        body,
        labels,
    };

    let client = reqwest::Client::new();
    let response = client
        .post(format!(
            "https://api.github.com/repos/{}/issues",
            GITHUB_REPO
        ))
        .header("Authorization", format!("Bearer {}", GITHUB_TOKEN))
        .header("User-Agent", "Tally-App")
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&issue)
        .send()
        .await
        .map_err(|e| format!("Netzwerkfehler: {}", e))?;

    if response.status().is_success() {
        let issue_response: GitHubIssueResponse = response
            .json()
            .await
            .map_err(|e| format!("Fehler beim Parsen: {}", e))?;

        Ok(FeedbackResult {
            success: true,
            issue_number: Some(issue_response.number),
            issue_url: Some(issue_response.html_url),
            error: None,
        })
    } else {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        Ok(FeedbackResult {
            success: false,
            issue_number: None,
            issue_url: None,
            error: Some(format!("GitHub API Fehler ({}): {}", status, error_text)),
        })
    }
}

// ── Open Graph metadata fetching ─────────────────────────────────────────

#[derive(Debug, Serialize)]
struct OgMetadata {
    title: Option<String>,
    description: Option<String>,
    image: Option<String>,
    site_name: Option<String>,
    favicon: Option<String>,
    url: String,
}

/// Extracts the content attribute from the first matching OG meta tag
fn extract_og(html: &str, property: &str) -> Option<String> {
    // Match <meta property="og:title" content="..."> or <meta content="..." property="og:title">
    let pattern = format!("property=\"{}\"", property);
    if let Some(meta_start) = html.find(&pattern) {
        // Search in a window around the match for the content attribute
        let window_start = if meta_start > 200 { meta_start - 200 } else { 0 };
        let window_end = std::cmp::min(meta_start + 300, html.len());
        let window = &html[window_start..window_end];

        // Find the <meta tag that contains this property
        if let Some(tag_start) = window.rfind("<meta") {
            let tag_content = &window[tag_start..];
            if let Some(tag_end) = tag_content.find('>') {
                let tag = &tag_content[..tag_end + 1];
                // Extract content="..."
                if let Some(content_start) = tag.find("content=\"") {
                    let value_start = content_start + 9;
                    if let Some(value_end) = tag[value_start..].find('"') {
                        let value = &tag[value_start..value_start + value_end];
                        if !value.is_empty() {
                            return Some(html_escape_decode(value));
                        }
                    }
                }
            }
        }
    }
    None
}

/// Extract <title> tag content as fallback
fn extract_title(html: &str) -> Option<String> {
    if let Some(start) = html.find("<title") {
        if let Some(tag_end) = html[start..].find('>') {
            let content_start = start + tag_end + 1;
            if let Some(end) = html[content_start..].find("</title>") {
                let title = html[content_start..content_start + end].trim();
                if !title.is_empty() {
                    return Some(html_escape_decode(title));
                }
            }
        }
    }
    None
}

/// Extract favicon link from HTML
fn extract_favicon(html: &str, base_url: &str) -> Option<String> {
    // Look for <link rel="icon" or <link rel="shortcut icon"
    for pattern in &["rel=\"icon\"", "rel=\"shortcut icon\"", "rel=\"apple-touch-icon\""] {
        if let Some(pos) = html.find(pattern) {
            let window_start = if pos > 300 { pos - 300 } else { 0 };
            let window_end = std::cmp::min(pos + 100, html.len());
            let window = &html[window_start..window_end];

            if let Some(tag_start) = window.rfind("<link") {
                let tag_content = &window[tag_start..];
                if let Some(href_start) = tag_content.find("href=\"") {
                    let value_start = href_start + 6;
                    if let Some(value_end) = tag_content[value_start..].find('"') {
                        let href = &tag_content[value_start..value_start + value_end];
                        if href.starts_with("http") {
                            return Some(href.to_string());
                        } else if href.starts_with("//") {
                            return Some(format!("https:{}", href));
                        } else {
                            // Relative URL — resolve against base
                            let base = base_url.trim_end_matches('/');
                            let path = href.trim_start_matches('/');
                            return Some(format!("{}/{}", base, path));
                        }
                    }
                }
            }
        }
    }
    // Fallback: /favicon.ico
    let base = base_url.trim_end_matches('/');
    Some(format!("{}/favicon.ico", base))
}

fn html_escape_decode(s: &str) -> String {
    s.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#x27;", "'")
        .replace("&apos;", "'")
}

fn get_base_url(url: &str) -> String {
    if let Some(scheme_end) = url.find("://") {
        if let Some(path_start) = url[scheme_end + 3..].find('/') {
            return url[..scheme_end + 3 + path_start].to_string();
        }
    }
    url.to_string()
}

#[tauri::command]
async fn fetch_og_metadata(url: String) -> Result<OgMetadata, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; TallyApp/1.0)")
        .header("Accept", "text/html")
        .send()
        .await
        .map_err(|e| format!("Netzwerkfehler: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let html = response
        .text()
        .await
        .map_err(|e| format!("Fehler beim Lesen: {}", e))?;

    // Only parse the first ~20KB for performance (meta tags are in <head>)
    let html_head: &str = if html.len() > 20_000 {
        &html[..20_000]
    } else {
        &html
    };

    let base_url = get_base_url(&url);

    // Resolve relative OG image URLs
    let og_image = extract_og(html_head, "og:image").map(|img| {
        if img.starts_with("http") {
            img
        } else if img.starts_with("//") {
            format!("https:{}", img)
        } else {
            let base = base_url.trim_end_matches('/');
            let path = img.trim_start_matches('/');
            format!("{}/{}", base, path)
        }
    });

    Ok(OgMetadata {
        title: extract_og(html_head, "og:title").or_else(|| extract_title(html_head)),
        description: extract_og(html_head, "og:description"),
        image: og_image,
        site_name: extract_og(html_head, "og:site_name"),
        favicon: extract_favicon(html_head, &base_url),
        url,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            app
                .handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![submit_feedback, fetch_og_metadata])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
