const Cc = Components.classes;
const Ci = Components.interfaces;
const Cm = Components.manager;
const Cu = Components.utils;
const Cr = Components.results;

Cm.QueryInterface(Ci.nsIComponentRegistrar);

Cu.import('resource://gre/modules/XPCOMUtils.jsm');
Cu.import('resource://gre/modules/Services.jsm');
Cu.import('resource://gre/modules/Preferences.jsm');

function RemoteCommandLine(target, url, cl) {
  this._target = target;
  this._url = url;
  this._cl = cl;
}

RemoteCommandLine.prototype = {
  get preventDefault() {
    return this._cl.preventDefault;
  }, 
  set preventDefault(value) {
    this._cl.preventDefault = value;
  },
  handleFlag: function(flag, caseSensitive) {
    return false;
  },
  handleFlagWithParam: function(flag, caseSensitive) {
    if (!(flag == 'new-tab' && this._target == Ci.nsIBrowserDOMWindow.OPEN_NEWTAB) &&
        !(flag == 'new-window' && this._target == Ci.nsIBrowserDOMWindow.OPEN_NEWWINDOW))
      return null;
    var url = this._url;
    this._url = null;
    return url
  },
  resolveURI: function(url) {
    return this._cl.resolveURI(url);
  },
};

function Remote() {}

Remote.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsICommandLineHandler]),
  classDescription: 'remote',
  classID: Components.ID('{1280e159-cac2-4188-af5a-e6089527b7b8}'),
  contractID: '@mozilla.org/commandlinehandler/general-startup;1?type=remote',

  handle: function(cmdLine)
  {
    try {
      var remoteCommand = cmdLine.handleFlagWithParam("remote", true);
    }
    catch (e) {
      throw Cr.NS_ERROR_ABORT;
    }

    if (remoteCommand != null) {
      try {
        var a = /^\s*(\w+)\(([^\)]*)\)\s*$/.exec(remoteCommand);
        var remoteVerb;
        if (a) {
          remoteVerb = a[1].toLowerCase();
          var remoteParams = [];
          var sepIndex = a[2].lastIndexOf(",");
          if (sepIndex == -1)
            remoteParams[0] = a[2];
          else {
            remoteParams[0] = a[2].substring(0, sepIndex);
            remoteParams[1] = a[2].substring(sepIndex + 1);
          }
        }

        switch (remoteVerb) {
        case "openurl":
        case "openfile":
          // openURL(<url>)
          // openURL(<url>,new-window)
          // openURL(<url>,new-tab)

          // First param is the URL, second param (if present) is the "target"
          // (tab, window)
          var url = remoteParams[0];
          var target = Ci.nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW;
          if (remoteParams[1]) {
            var targetParam = remoteParams[1].toLowerCase()
                                             .replace(/^\s*|\s*$/g, "");
            if (targetParam == "new-tab")
              target = Ci.nsIBrowserDOMWindow.OPEN_NEWTAB;
            else if (targetParam == "new-window")
              target = Ci.nsIBrowserDOMWindow.OPEN_NEWWINDOW;
            else {
              // The "target" param isn't one of our supported values, so
              // assume it's part of a URL that contains commas.
              url += "," + remoteParams[1];
            }
          }

          if (target == Ci.nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW) {
            target = Preferences.get('browser.link.open_newwindow',
                                     Ci.nsIBrowserDOMWindow.OPEN_NEWTAB);
          }

          var clh = Cc['@mozilla.org/browser/clh;1'].getService(Ci.nsICommandLineHandler);
          clh.handle(new RemoteCommandLine(target, url, cmdLine));
          break;


        case "ping":
          break;
        default:
          // Somebody sent us a remote command we don't know how to process:
          // just abort.
          throw "Unknown remote command.";
        }

        cmdLine.preventDefault = true;
      }
      catch (e) {
        Components.utils.reportError(e);
        // If we had a -remote flag but failed to process it, throw
        // NS_ERROR_ABORT so that the xremote code knows to return a failure
        // back to the handling code.
        throw Cr.NS_ERROR_ABORT;
      }
    }
  },
};

const RemoteFactory = XPCOMUtils.generateNSGetFactory([Remote])(Remote.prototype.classID);

function startup(aData, aReason) {
  Cm.registerFactory(Remote.prototype.classID,
                     Remote.prototype.classDescription,
                     Remote.prototype.contractID,
                     RemoteFactory);
  var catman = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
  catman.addCategoryEntry('command-line-handler', 'l-remote', Remote.prototype.contractID, false, true);
}

function shutdown(aData, aReason) {
  var catman = Cc["@mozilla.org/categorymanager;1"].getService(Ci.nsICategoryManager);
  catman.deleteCategoryEntry('command-line-handler', 'l-remote', false);
  Cm.unregisterFactory(Remote.prototype.classID, RemoteFactory);
}
function install(aData, aReason) { }
function uninstall(aData, aReason) { }
