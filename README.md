# Unread Topics

This is a Google Chrome extension developed to try to help the users (including myself) of a SMF Forum.

The main feature is to automatically fetch and open the unread posts in different tabs.
In addition, users can upload images into their posts with a simple copy-paste.

At lunchtime, the canteen menu can also be consulted.


## Features

* Subscribe to new posts updates (GCM/FCM)
* Fetch and open unread topics
	* Key shortcuts
	* Sidebar injected on forum
	* Icon popup page
* Search for topics by name
* Sync personal settings with Google Account
* Display preview of images/GIFs/videos from their URLs
* Sync/display canteen month menus

## Technologies & Libraries
* Google/Firabase Cloud Messaging ([GCM](https://developers.google.com/cloud-messaging/chrome/client))
* Simple Machines Forum ([SMF](http://www.simplemachines.org/))
* [jQuery 2.1.1](https://jquery.com/)
* [ES6 Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
* [chrome-promise](https://github.com/tfoxy/chrome-promise)


## Author

Paulo Sousa & ... & Tango Uniform

Special thanks to the forum admins and to friends for advices and suggestions! :aqueleabraço:

# Deployment

This extension is not maintained anymore. Manifest is outdated so the extension is out of the Chrome Web Store.
The extension can be manually installed by following the instructions below.

## Download

In the desired folder, clone the repository:
```bash
git clone https://github.com/prsousa/UnreadTopics
``` 
Or download the ZIP of the repository and extract it to the desired folder.

## Add extension to Chrome

1. Open Chrome and go to [chrome://extensions/](chrome://extensions/) 
2. Enable `Developer mode` (usually on the top right corner)
3. Click on `Load unpacked` and select the folder created when the repository was cloned
4. The extension should be added to Chrome and the icon should appear on the extensions menu. To have the icon always visible, click on the pin icon next to the extension.

## Configuration

- It is possible to select the vegan option for the canteen menu. To do so, go to the settings page of the extension and check the box `Ementa Vegetariana`.
- Explore the other settings and configure them as desired to have the best experience with the extension.
