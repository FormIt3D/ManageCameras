window.ManageCameras = window.ManageCameras || {};

/*** web/UI code - runs natively in the plugin process ***/

// inputs whose value will be updated when the camera changes
ManageCameras.cameraHeightFromLevelInputModule = undefined;
ManageCameras.cameraHeightFromGroundInputModule = undefined;

// checkbox input IDs
ManageCameras.copyCamerasToClipboardCheckboxID = 'copyCamerasToClipboardCheckbox';
ManageCameras.useClipboardCamerasCheckboxID = 'useClipboardCamerasCheckbox';

// camera data from the client script
ManageCameras.currentCameraData = undefined;
ManageCameras.currentLevelsData = undefined;
ManageCameras.closestLevelName = undefined;
ManageCameras.closestLevelElevationStr = undefined;

// update the FormIt camera height from the "above level" input
ManageCameras.setCameraHeightAboveLevelFromInput = function()
{
    let newCameraHeightFromLevelStr = ManageCameras.cameraHeightFromLevelInputModule.getInput().value;
    let args = { "currentCameraData" : ManageCameras.currentCameraData,
                    "closestLevelElevationStr" : ManageCameras.closestLevelElevationStr,
                    "newCameraHeightFromLevelStr" : newCameraHeightFromLevelStr };

    window.FormItInterface.CallMethod("ManageCameras.setCameraHeightFromLevel", args, function(result)
    {

    });
     
    ManageCameras.updateUI();
}

// update the FormIt camera height from the "above ground" input
ManageCameras.setCameraHeightAboveGroundFromInput = function()
{ 
    let newCameraHeightFromGroundStr = ManageCameras.cameraHeightFromGroundInputModule.getInput().value;

    let args = { "currentCameraData" : ManageCameras.currentCameraData,
                    "newCameraHeightFromGroundStr" : newCameraHeightFromGroundStr };

    window.FormItInterface.CallMethod("ManageCameras.setCameraHeightFromGround", args, function(result)
    {

    });
     
    ManageCameras.updateUI();
}

ManageCameras.updateUI = function()
{
    window.FormItInterface.CallMethod("ManageCameras.getCurrentCameraData", { }, function(cameraData)
    {
        cameraData = JSON.parse(cameraData);
        ManageCameras.currentCameraData = cameraData.currentCameraData;
        ManageCameras.currentLevelsData = cameraData.currentLevelsData;
        ManageCameras.closestLevelName = cameraData.closestLevelName;
        ManageCameras.closestLevelElevationStr = cameraData.closestLevelElevationStr;
    
        // get the camera height from the ground, and set it as the input value
        let cameraHeightFromGroundStr = cameraData.cameraHeightAboveGroundStr;
        let cameraHeightFromGroundInput = ManageCameras.cameraHeightFromGroundInputModule.getInput();
        cameraHeightFromGroundInput.value = cameraHeightFromGroundStr;
    
        // if there are levels, and if we're above at least one level,
        // show the "camera height above level" module
        if (ManageCameras.currentLevelsData != '' && ManageCameras.closestLevelName != undefined)
        {
            // get the camera height above the nearest level
            let cameraHeightFromLevelInput = ManageCameras.cameraHeightFromLevelInputModule.getInput();
    
            // show the level height input module
            ManageCameras.cameraHeightFromLevelInputModule.element.className = 'inputModuleContainer';

            // set the height above nearest level as the input value
            cameraHeightFromLevelInput.value = cameraData.cameraHeightAboveLevelStr;

            // update the label to indicate the Level the camera is above
            ManageCameras.cameraHeightFromLevelInputModule.setLabel("Height above level (" + cameraData.closestLevelName + "):");
        }
        // otherwise, hide the "camera height above level" module - it doesn't apply
        else
        {   
            ManageCameras.cameraHeightFromLevelInputModule.element.className = 'hide';
        }   
    });
}

// initialize the UI
ManageCameras.initializeUI = function()
{
    // create an overall container for all objects that comprise the "content" of the plugin
    // everything except the footer
    let contentContainer = document.createElement('div');
    contentContainer.id = 'contentContainer';
    contentContainer.className = 'contentContainer'
    window.document.body.appendChild(contentContainer);

    // create the overall header
    let headerContainer = new FormIt.PluginUI.HeaderModule('Manage Cameras', 'Manage camera objects, including the current camera and cameras from Scenes.', 'headerContainer');
    contentContainer.appendChild(headerContainer.element);

    // separator and space
    contentContainer.appendChild(document.createElement('hr'));
    contentContainer.appendChild(document.createElement('p'));

    //
    // create the camera details container
    //

    let cameraDetailsSubheader = new FormIt.PluginUI.HeaderModule('Main Camera', '', 'headerContainer');
    contentContainer.appendChild(cameraDetailsSubheader.element);

    ManageCameras.cameraHeightFromLevelInputModule = new FormIt.PluginUI.TextInputModule('Height Above Level ', 'cameraHeightFromLevelModule', 'inputModuleContainer', 'cameraHeightFromNearestLevelInput', ManageCameras.setCameraHeightAboveLevelFromInput);
    contentContainer.appendChild(ManageCameras.cameraHeightFromLevelInputModule.element);

    ManageCameras.cameraHeightFromGroundInputModule = new FormIt.PluginUI.TextInputModule('Height Above Ground: ', 'cameraHeightFromGroundModule', 'inputModuleContainer', 'cameraHeightFromGroundInput', ManageCameras.setCameraHeightAboveGroundFromInput);
    contentContainer.appendChild(ManageCameras.cameraHeightFromGroundInputModule.element);

    // separator and space
    contentContainer.appendChild(document.createElement('p'));
    contentContainer.appendChild(document.createElement('hr'));
    contentContainer.appendChild(document.createElement('p'));

    // 
    // create the generate cameras from scenes section
    //
    let generateSceneCamerasSubheader = new FormIt.PluginUI.HeaderModule('Export Scenes to Cameras', "For each Scene in this project, create a Camera object that stores the Scene's camera and metadata.", 'headerContainer');
    contentContainer.appendChild(generateSceneCamerasSubheader.element);

    let detailsUL = contentContainer.appendChild(document.createElement('ul'));

    let detailsLI1 = detailsUL.appendChild(document.createElement('li'));
    detailsLI1.innerHTML = 'Use the "Cameras" Layer to control the visibility of these new Camera objects.';
    let detailsLI2 = detailsUL.appendChild(document.createElement('li'));
    detailsLI2.innerHTML = 'Camera geometry can be used to transfer camera data between FormIt projects, or other apps.';

    // copy cameras to clipboard checkbox
    let copyCamerasToClipboardCheckboxModule = new FormIt.PluginUI.CheckboxModule('Copy Cameras to Clipboard', 'copyCamerasCheckboxModule', 'multiModuleContainer', ManageCameras.copyCamerasToClipboardCheckboxID);
    contentContainer.appendChild(copyCamerasToClipboardCheckboxModule.element);
    document.getElementById(ManageCameras.copyCamerasToClipboardCheckboxID).checked = true;

    // the generate button
    let exportScenesToCamerasButton = new FormIt.PluginUI.Button('Export Scenes to Cameras', function()
    {
        let args = {
            "copyToClipboard" : document.getElementById(ManageCameras.copyCamerasToClipboardCheckboxID).checked,
            "useClipboard" : document.getElementById(ManageCameras.useClipboardCamerasCheckboxID).checked
        }

        window.FormItInterface.CallMethod("ManageCameras.executeGenerateCameraGeometry", args);
    });
    contentContainer.appendChild(exportScenesToCamerasButton.element);

    //
    // create the update scene cameras from geometry section
    //
    let updateScenesFromCamerasSubheader = new FormIt.PluginUI.HeaderModule('Import Scenes from Cameras', 'For each available Camera, update or create the associated Scene in this project.');
    contentContainer.appendChild(updateScenesFromCamerasSubheader.element);

    // use cameras on clipboard checkbox
    let useCamerasOnClipboardCheckboxModule = new FormIt.PluginUI.CheckboxModule('Look for Cameras on Clipboard', 'copyCamerasCheckboxModule', 'multiModuleContainer', ManageCameras.useClipboardCamerasCheckboxID);
    contentContainer.appendChild(useCamerasOnClipboardCheckboxModule.element);
    document.getElementById(ManageCameras.useClipboardCamerasCheckboxID).checked = true;

    // the update button
    let importScenesFromCamerasButton = new FormIt.PluginUI.Button('Import Scenes from Cameras', function()
    {
        let args = {
            "copyToClipboard" : document.getElementById(ManageCameras.copyCamerasToClipboardCheckboxID).checked,
            "useClipboard" : document.getElementById(ManageCameras.useClipboardCamerasCheckboxID).checked
        }

        window.FormItInterface.CallMethod("ManageCameras.executeUpdateScenesFromCameras", args);
    });
    contentContainer.appendChild(importScenesFromCamerasButton.element);

    //
    // create the footer
    //
    let footerModule = new FormIt.PluginUI.FooterModule;
    document.body.appendChild(footerModule.element);
}