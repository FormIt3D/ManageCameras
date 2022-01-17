if (typeof ManageCameras == 'undefined')
{
    ManageCameras = {};
}

/*** application code - runs asynchronously from plugin process to communicate with FormIt ***/
/*** the FormIt application-side JS engine only supports ES5 syntax, so use var here ***/

// the container Group for cameras will be created in the Main History (0)
ManageCameras.cameraContainerGroupHistoryID = 0;

// the name of the container Group that will contain all cameras
ManageCameras.cameraContainerGroupAndLayerName = "Cameras";

// the string attribute key used for all Manage Cameras objects
ManageCameras.cameraStringAttributeKey = "FormIt::Plugins::ManageCameras";

// the default camera plane distance - from camera position point to plane (in feet)
ManageCameras.defaultCameraPlaneDistance = 5;

// updates variables about the camera
ManageCameras.getCurrentCameraData = function()
{
    var currentCameraData = FormIt.Cameras.GetCameraData();
    var currentCameraHeightAboveGround = currentCameraData.posZ;

    var currentLevelsData = FormIt.Levels.GetLevelsData (0, true);
    var closestLevelName;
    var closestLevelElevation = 0;

    // get the closest level below the camera
    for (var i = 0; i < currentLevelsData.length; i++)
    {
        // only proceed if this level is shorter than the current camera height
        if (currentLevelsData[i].Elevation < currentCameraHeightAboveGround)
        {
            // if we're not at the last Level
            if (i + 1 < currentLevelsData.Length)
            {
                // check if this Level is the closest below the Camera height
                if (currentCameraHeightAboveGround - currentLevelsData[i].Elevation < (currentLevelsData[i + 1].Elevation - currentLevelsData[i].Elevation))
                {
                    closestLevelName = currentLevelsData[i].Name;
                    closestLevelElevation = currentLevelsData[i].Elevation;

                }
            }
            // if we're at the end of the Levels list, this is the highest Level, and thus the closest
            else
            {
                closestLevelName = currentLevelsData[i].Name;
                closestLevelElevation = currentLevelsData[i].Elevation;
            }
        }
    }

    // return the data we need in a json for the web side to read from
    return {
        "currentCameraData" : FormIt.Cameras.GetCameraData(),
        "cameraHeightAboveGroundStr" : FormIt.StringConversion.LinearValueToString(currentCameraHeightAboveGround),
        "currentLevelsData" : currentLevelsData,
        "closestLevelName" : closestLevelName,
        "closestLevelElevationStr" : FormIt.StringConversion.LinearValueToString(closestLevelElevation),
        "cameraHeightAboveLevelStr" : FormIt.StringConversion.LinearValueToString(currentCameraHeightAboveGround - closestLevelElevation)
    }
}

// updates variables about the camera
ManageCameras.setCameraHeightFromLevel = function(args)
{
    var newCameraHeightFromLevel = (FormIt.StringConversion.StringToLinearValue(args.newCameraHeightFromLevelStr)).second;

    var closestLevelElevation = (FormIt.StringConversion.StringToLinearValue(args.closestLevelElevationStr)).second;

    var newCameraData = args.currentCameraData;
    newCameraData.posZ = closestLevelElevation + newCameraHeightFromLevel;

    FormIt.Cameras.SetCameraData(newCameraData);
}

ManageCameras.setCameraHeightFromGround = function(args)
{
    var newCameraHeightFromGround = (FormIt.StringConversion.StringToLinearValue(args.newCameraHeightFromGroundStr)).second;

    var newCameraData = args.currentCameraData;
    newCameraData.posZ = newCameraHeightFromGround;

    FormIt.Cameras.SetCameraData(newCameraData);
}

// get the history ID for the container of camera objects
// primarily used for the MatchPhoto plugin
ManageCameras.getOrCreateCameraObjectContainerHistoryID = function(nHistoryID, stringAttributeKey)
{
    
}

ManageCameras.createCameraGeometryForScenes = function(nHistoryID, scenes, aspectRatio, bCopyToClipboard)
{
    console.log("Building scene camera geometry...");

    // create or find the Cameras layer, and get its ID
    var camerasLayerID = FormIt.PluginUtils.Application.getOrCreateLayerByName(ManageCameras.cameraContainerGroupHistoryID, ManageCameras.cameraContainerGroupAndLayerName);

    // create a camera container Group
    var cameraContainerGroupID = FormIt.PluginUtils.Applicatoin.createOrReplaceGroupInstanceByStringAttributeKey(nHistoryID, ManageCameras.cameraStringAttributeKey, "CameraContainer");
    // get the instance ID of the Group
    var cameraContainerGroupInstanceID = JSON.parse(WSM.APIGetObjectsByTypeReadOnly(nHistoryID, cameraContainerGroupID, WSM.nObjectType.nInstanceType));
    // get the history for the camera container Group
    var cameraContainerGroupRefHistoryID = WSM.APIGetGroupReferencedHistoryReadOnly(nHistoryID, cameraContainerGroupID);

    // put the camera container group on the cameras layer
    FormIt.Layers.AssignLayerToObjects(camerasLayerID, cameraContainerGroupInstanceID);

    // set the name of the camera container group
    WSM.APISetObjectProperties(nHistoryID, cameraContainerGroupInstanceID, ManageCameras.cameraContainerGroupAndLayerName, false);
    // set the name of the camera container group instance
    WSM.APISetRevitFamilyInformation(cameraContainerGroupRefHistoryID, false, false, "", ManageCameras.cameraContainerGroupAndLayerName, "", "");

    // keep track of how many cameras were created
    var camerasCreatedCount = 0;

    // for each scene, get the camera data and recreate the camera geometry from the data
    for (var i = 0; i < scenes.length; i++)
    {
        var sceneData = scenes[i];
        //console.log("Camera: " + sceneCamera);

        var sceneName = scenes[i].name;
        //console.log("Scene name: " + sceneName);

        // create the geometry for this camera
        ManageCameras.createCameraObjectFromSceneData(cameraContainerGroupRefHistoryID, sceneData, aspectRatio);

        camerasCreatedCount++;

        console.log("Built new camera: " + sceneName);
    }

    var camerasWord;
    if (camerasCreatedCount === 0 || camerasCreatedCount > 1)
    {
        camerasWord = "Cameras";
    }
    else
    {
        camerasWord = "Camera";
    }

    // finished creating cameras, so var the user know what was changed
    var finishCreateCamerasMessage = "Created " + camerasCreatedCount + " new " + camerasWord + " from Scenes.";
    FormIt.UI.ShowNotification(finishCreateCamerasMessage, FormIt.NotificationType.Success, 0);
    console.log(finishCreateCamerasMessage);

    // if specified, copy the new cameras to the clipboard
    if (bCopyToClipboard)
    {
        // copy the new Camera container Group to the clipboard
        FormIt.Selection.ClearSelections();
        FormIt.Selection.AddSelections(cameraContainerGroupID);

        FormIt.Commands.DoCommand('Edit: Copy');
        FormIt.Selection.ClearSelections();
    }
}

// create a special camera object with attribute info on the scene it came from
ManageCameras.createCameraObjectFromSceneData = function(cameraContainerGroupHistoryID, sceneData, aspectRatio)
{
    var cameraData = sceneData.camera;
    var cameraGroupInstanceID = ManageCameras.createCameraGeometryFromCameraData(cameraContainerGroupHistoryID, cameraData, aspectRatio, ManageCameras.defaultCameraPlaneDistance);
    var cameraGroupHistoryID = WSM.APIGetGroupReferencedHistoryReadOnly(cameraContainerGroupHistoryID, cameraGroupInstanceID);
    
    // set the name of the camera group
    WSM.APISetRevitFamilyInformation(cameraGroupHistoryID, false, false, "", "Camera", "", "");
    // set the name of the camera group instance
    WSM.APISetObjectProperties(cameraContainerGroupHistoryID, cameraGroupInstanceID, sceneData.name, false);

    // add an attribute to the camera with the current scene and animation data
    var animationName = FormIt.Scenes.GetAnimationForScene(sceneData.name);
    var bAnimationLoop = FormIt.Scenes.GetAnimationLoop(animationName);
    var sceneAndAnimationData = { 'SceneData' : sceneData, 'AnimationName' :  animationName, 'AnimationLoop' : bAnimationLoop };
    WSM.Utils.SetOrCreateStringAttributeForObject(cameraContainerGroupHistoryID,
        cameraGroupInstanceID, ManageCameras.cameraStringAttributeKey, JSON.stringify(sceneAndAnimationData));
}

// creates camera geometry from the given camera data, and returns the instance ID of the generated camera
ManageCameras.createCameraGeometryFromCameraData = function(nHistoryID, cameraData, aspectRatio, cameraPlaneDistance)
{
    // cameras will need to be moved to the origin, then Grouped, then moved back (to get the LCS correct)
    var origin = WSM.Geom.Point3d(0, 0, 0);

    // get the FOV from the camera data
    var FOV = cameraData.FOV;

    if (cameraPlaneDistance == undefined)
    {
        cameraPlaneDistance = ManageCameras.defaultCameraPlaneDistance;
    }

    // determine the normalized view width and height
    // an aspect ratio of zero will use the current camera's aspect ratio
    if (aspectRatio <= 1.0) {
        width = Math.tan(FOV);
        height = width / aspectRatio;
    } else {
        height = Math.tan(FOV);
        width = height * aspectRatio;
    }
   
    // multiply the width and height by distance
    height *= cameraPlaneDistance;
    width *= cameraPlaneDistance;

    // construct the camera forward vector
    var cameraForwardVector = FormIt.PluginUtils.Math.multiplyVectorByQuaternion(0, 0, -1, cameraData.rotX, cameraData.rotY, cameraData.rotZ, cameraData.rotW);
    // scale the vector by the distance
    cameraForwardVector = FormIt.PluginUtils.Math.scaleVector(cameraForwardVector, cameraPlaneDistance);
    var cameraForwardVector3d = WSM.Geom.Vector3d(cameraForwardVector[0], cameraForwardVector[1], cameraForwardVector[2]);
    //console.log(JSON.stringify(cameraForwardVector3d));

    // construct the camera up vector
    var cameraUpVector = FormIt.PluginUtils.Math.multiplyVectorByQuaternion(0, 1, 0, cameraData.rotX, cameraData.rotY, cameraData.rotZ, cameraData.rotW);   
    // scale the vector by the  height
    cameraUpVector = FormIt.PluginUtils.Math.scaleVector(cameraUpVector, height);
    var cameraUpVector3d = WSM.Geom.Vector3d(cameraUpVector[0], cameraUpVector[1], cameraUpVector[2]);
    //console.log(JSON.stringify(cameraUpVector3d));

    // construct the camera right vector
    var cameraRightVector = FormIt.PluginUtils.Math.multiplyVectorByQuaternion(-1, 0, 0, cameraData.rotX, cameraData.rotY, cameraData.rotZ, cameraData.rotW);
    // scale the vector by the  width
    cameraRightVector = FormIt.PluginUtils.Math.scaleVector(cameraRightVector, width);
    var cameraRightVector3d = WSM.Geom.Vector3d(cameraRightVector[0], cameraRightVector[1], cameraRightVector[2]);
    //console.log(JSON.stringify(cameraRightVector3d));

    // get the current camera's position
    var cameraPosition = WSM.Geom.Point3d(cameraData.posX, cameraData.posY, cameraData.posZ);
    //console.log(JSON.stringify(cameraPosition));

    // construct the 4 corners of the camera

    // lower left
    var point0x = cameraPosition.x + cameraForwardVector3d.x - cameraRightVector3d.x - cameraUpVector3d.x;
    var point0y = cameraPosition.y + cameraForwardVector3d.y - cameraRightVector3d.y - cameraUpVector3d.y;
    var point0z = cameraPosition.z + cameraForwardVector3d.z - cameraRightVector3d.z - cameraUpVector3d.z;
    var point0 = WSM.Geom.Point3d(point0x, point0y, point0z);

    // upper left
    var point1x = cameraPosition.x + cameraForwardVector3d.x - cameraRightVector3d.x + cameraUpVector3d.x;
    var point1y = cameraPosition.y + cameraForwardVector3d.y - cameraRightVector3d.y + cameraUpVector3d.y;
    var point1z = cameraPosition.z + cameraForwardVector3d.z - cameraRightVector3d.z + cameraUpVector3d.z;
    var point1 = WSM.Geom.Point3d(point1x, point1y, point1z);

    // upper right
    var point2x = cameraPosition.x + cameraForwardVector3d.x + cameraRightVector3d.x + cameraUpVector3d.x;
    var point2y = cameraPosition.y + cameraForwardVector3d.y + cameraRightVector3d.y + cameraUpVector3d.y;
    var point2z = cameraPosition.z + cameraForwardVector3d.z + cameraRightVector3d.z + cameraUpVector3d.z;
    var point2 = WSM.Geom.Point3d(point2x, point2y, point2z);

    // lower right
    var point3x = cameraPosition.x + cameraForwardVector3d.x + cameraRightVector3d.x - cameraUpVector3d.x;
    var point3y = cameraPosition.y + cameraForwardVector3d.y + cameraRightVector3d.y - cameraUpVector3d.y;
    var point3z = cameraPosition.z + cameraForwardVector3d.z + cameraRightVector3d.z - cameraUpVector3d.z;
    var point3 = WSM.Geom.Point3d(point3x, point3y, point3z);

    // all camera points
    var points = [point0, point1, point2, point3];

    // the end points of the camera frustum lines
    var frustumLineEndoints0 = [cameraPosition, point0];
    var frustumLineEndpoints1 = [cameraPosition, point1];
    var frustumLineEndpoints2 = [cameraPosition, point2];
    var frustumLineEndpoints3 = [cameraPosition, point3];

    // set up an array to capture all camera geometry objects
    var cameraObjectIDs = [];

    // create a vertex at the camera position
    var cameraPosVertexObjectID = WSM.APICreateVertex(nHistoryID, cameraPosition);

    var frustumLinesObjectIDs = [];
    // create lines from the camera position to the camera corners
    var frustumLine0 = WSM.APICreatePolyline(nHistoryID, frustumLineEndoints0, false);
    frustumLinesObjectIDs.push((WSM.APIGetCreatedChangedAndDeletedInActiveDeltaReadOnly(nHistoryID, WSM.nObjectType.nEdgeType)).created);
    var frustumLine1 = WSM.APICreatePolyline(nHistoryID, frustumLineEndpoints1, false);
    frustumLinesObjectIDs.push((WSM.APIGetCreatedChangedAndDeletedInActiveDeltaReadOnly(nHistoryID, WSM.nObjectType.nEdgeType)).created);
    var frustumLine2 = WSM.APICreatePolyline(nHistoryID, frustumLineEndpoints2, false);
    frustumLinesObjectIDs.push((WSM.APIGetCreatedChangedAndDeletedInActiveDeltaReadOnly(nHistoryID, WSM.nObjectType.nEdgeType)).created);
    var frustumLine3 = WSM.APICreatePolyline(nHistoryID, frustumLineEndpoints3, false);
    frustumLinesObjectIDs.push((WSM.APIGetCreatedChangedAndDeletedInActiveDeltaReadOnly(nHistoryID, WSM.nObjectType.nEdgeType)).created);

    // connect the points with a rectangle - this will create a rectangular surface in front of the camera
    WSM.APICreatePolyline(nHistoryID, points, true);

    // get the face and push it into the array
    var faceObjectID = (WSM.APIGetCreatedChangedAndDeletedInActiveDeltaReadOnly(nHistoryID, WSM.nObjectType.nFaceType)).created;

    // add the camera position vertex and the frustum lines to the camera geometry array
    //cameraObjectIDs.push(cameraPosVertexObjectID);
    cameraObjectIDs.push(frustumLinesObjectIDs);
    cameraObjectIDs.push(faceObjectID);

    cameraObjectIDs = FormIt.PluginUtils.Array.flatten(cameraObjectIDs);

    //
    // we want to put the camera in a Group, and set the LCS to align with the camera geometry
    // to do this, we need to move the camera to the origin, and rotate it in 3D to point along an axis
    // then make it into a Group, so the Group's origin and axis alignments match the camera plane
    // 

    // get the vector from the camera's position to the origin
    var cameraToOriginVector = FormIt.PluginUtils.Math.getVectorBetweenTwoPoints(cameraPosition.x, cameraPosition.y, cameraPosition.z, 0, 0, 0);
    // convert the vector to the resulting WSM point3d
    var translatedCameraPositionPoint3d = WSM.Geom.Point3d(cameraToOriginVector[0], cameraToOriginVector[1], cameraToOriginVector[2]);

    // create a transform for moving the camera to the origin, keeping its current orientation
    var cameraMoveToOriginTransform = WSM.Geom.MakeRigidTransform(translatedCameraPositionPoint3d, WSM.Geom.Vector3d(1, 0, 0), WSM.Geom.Vector3d(0, 1, 0), WSM.Geom.Vector3d(0, 0, 1));


    // create a transform for rotating the camera to face an axis
    // this requires the geometry to be at the world origin
    // the position of cameraForwardVector3d determines which axis the camera will face
    var cameraRotateToAxisTransform = WSM.Geom.MakeRigidTransform(origin, cameraRightVector3d, cameraUpVector3d, cameraForwardVector3d);
    // invert the transform
    var cameraRotateToAxisTransformInverted = WSM.Geom.InvertTransform(cameraRotateToAxisTransform);

    // first, only move the camera to the origin (no rotation)
    WSM.APITransformObjects(nHistoryID, cameraObjectIDs, cameraMoveToOriginTransform);

    // now rotate the camera to face the axis
    WSM.APITransformObjects(nHistoryID, cameraObjectIDs, cameraRotateToAxisTransformInverted);

    // 
    // now that the camera is at the origin, and aligned correctly, we can Group it
    //

    // create a new Group for this Scene's Camera
    var cameraGroupID = WSM.APICreateGroup(nHistoryID, cameraObjectIDs);
    // get the instance ID of the Group
    var cameraGroupInstanceID = JSON.parse(WSM.APIGetObjectsByTypeReadOnly(nHistoryID, cameraGroupID, WSM.nObjectType.nInstanceType));
    // create a new history for the camera
    var cameraGroupHistoryID = WSM.APIGetGroupReferencedHistoryReadOnly(nHistoryID, cameraGroupID);

    // store the camera data on the camera instance
    ManageCameras.setCameraDataInCameraObjectAttribute(nHistoryID, cameraGroupInstanceID, cameraData);

    //
    // put the camera plane in its own Group, with the origin at the centroid
    //

    // get the face - this is the camera plane
    // this assumes there's only 1 face represented from the camera geometry
    var newContextCameraViewPlaneFaceID = JSON.parse((WSM.APIGetCreatedChangedAndDeletedInActiveDeltaReadOnly(cameraGroupHistoryID, WSM.nObjectType.nFaceType)).created);
    
    var cameraViewPlaneCentroidPoint3d = WSM.APIGetFaceCentroidPoint3dReadOnly(cameraGroupHistoryID, newContextCameraViewPlaneFaceID);
    //console.log(cameraViewPlaneCentroidPoint3d);

    var cameraViewPlaneMoveToOriginVector = FormIt.PluginUtils.Math.getVectorBetweenTwoPoints(cameraViewPlaneCentroidPoint3d.x, cameraViewPlaneCentroidPoint3d.y, cameraViewPlaneCentroidPoint3d.z, 0, 0, 0);
    var translatedCameraPlanePositionPoint3d = WSM.Geom.Point3d(cameraViewPlaneMoveToOriginVector[0], cameraViewPlaneMoveToOriginVector[1], cameraViewPlaneMoveToOriginVector[2]);

    // create a transform for moving the camera plane to the origin
    var cameraPlaneMoveToOriginTransform = WSM.Geom.MakeRigidTransform(translatedCameraPlanePositionPoint3d, WSM.Geom.Vector3d(1, 0, 0), WSM.Geom.Vector3d(0, 1, 0), WSM.Geom.Vector3d(0, 0, 1));

    // create a transform for moving the camera plane back to its original position
    var cameraViewPlaneReturnToPosTransform = WSM.Geom.MakeRigidTransform(cameraViewPlaneCentroidPoint3d, WSM.Geom.Vector3d(1, 0, 0), WSM.Geom.Vector3d(0, 1, 0), WSM.Geom.Vector3d(0, 0, 1));

    // move the camera plane to the origin
    WSM.APITransformObjects(cameraGroupHistoryID, newContextCameraViewPlaneFaceID, cameraPlaneMoveToOriginTransform);

    // create a new Group for the camera viewplane
    var cameraViewPlaneGroupID = WSM.APICreateGroup(cameraGroupHistoryID, newContextCameraViewPlaneFaceID);

    // get the instanceID of the Group
    var cameraViewPlaneGroupInstanceID = JSON.parse(WSM.APIGetObjectsByTypeReadOnly(cameraGroupHistoryID, cameraViewPlaneGroupID, WSM.nObjectType.nInstanceType));
    // create a new history for the camera view plane
    var cameraViewPlaneGroupHistoryID = WSM.APIGetGroupReferencedHistoryReadOnly(cameraGroupHistoryID, cameraViewPlaneGroupID);

    // set the name of the view plane group
    WSM.APISetRevitFamilyInformation(cameraViewPlaneGroupHistoryID, false, false, "", "ViewPlane", "", "");
    // set the name of the view plane instance
    WSM.APISetObjectProperties(cameraViewPlaneGroupHistoryID, cameraViewPlaneGroupInstanceID, "View Plane", false);

    // move the view plane instance back to where it belongs
    WSM.APITransformObjects(cameraGroupHistoryID, cameraViewPlaneGroupID, cameraViewPlaneReturnToPosTransform);

    //
    // move the frustum lines into their own group
    // 

    var newContextFrustumLinesObjectIDs = WSM.APIGetAllObjectsByTypeReadOnly(cameraGroupHistoryID, WSM.nObjectType.nEdgeType);

    // move the camera frustum lines to the origin
    WSM.APITransformObjects(cameraGroupHistoryID, newContextFrustumLinesObjectIDs, cameraPlaneMoveToOriginTransform);

    // create a new Group for the camera frustum lines
    var cameraFrustumLinesGroupID = WSM.APICreateGroup(cameraGroupHistoryID, newContextFrustumLinesObjectIDs);
    // get the instanceID of the Group
    var cameraFrustumLinesGroupInstanceID = JSON.parse(WSM.APIGetObjectsByTypeReadOnly(cameraGroupHistoryID, cameraFrustumLinesGroupID, WSM.nObjectType.nInstanceType));
    // create a new history for the camera view plane
    var cameraFrustumLinesGroupHistoryID = WSM.APIGetGroupReferencedHistoryReadOnly(cameraGroupHistoryID, cameraFrustumLinesGroupID);

    // set the name of the view plane group
    WSM.APISetRevitFamilyInformation(cameraFrustumLinesGroupHistoryID, false, false, "", "FrustumLines", "", "");
    // set the name of the view plane instance
    WSM.APISetObjectProperties(cameraFrustumLinesGroupHistoryID, cameraFrustumLinesGroupInstanceID, "Frustum Lines", false);

    // move the frustum lines instance back to where it belongs
    WSM.APITransformObjects(cameraGroupHistoryID, cameraFrustumLinesGroupID, cameraViewPlaneReturnToPosTransform);

    //
    // now move the Group Instance back to the camera's original position
    //

    // create a tranform to move the camera back and reset its alignment to where it was
    var cameraReturnToCameraPosTransform = WSM.Geom.MakeRigidTransform(cameraPosition, cameraRightVector3d, cameraUpVector3d, cameraForwardVector3d);

    // move and rotate the camera back
    WSM.APITransformObjects(nHistoryID, cameraGroupInstanceID, cameraReturnToCameraPosTransform);

    //
    // move the camera position vertex into the camera Group
    //

    WSM.APICopyOrSketchAndTransformObjects(nHistoryID, cameraGroupHistoryID, cameraPosVertexObjectID, cameraMoveToOriginTransform, 1);
    WSM.APIDeleteObject(nHistoryID, cameraPosVertexObjectID); 

    return cameraGroupInstanceID;
}

ManageCameras.updateScenesFromCameras = function(args)
{
    // first, check if the Cameras Group exists
    var cameraContainerGroupID = (FormIt.PluginUtils.Application.getGroupInstancesByStringAttributeKey(ManageCameras.cameraContainerGroupHistoryID, ManageCameras.cameraStringAttributeKey))[0];

    // if specified, use the clipboard data to find the new cameras
    if (args.useClipboard)
    {
        // first, ensure the user is in the Main History, with nothing selected
        FormIt.GroupEdit.EndEditInContext();
        FormIt.Selection.ClearSelections();

        FormIt.Commands.DoCommand('Edit: Paste In Place');

        // the new geometry should be selected, so get some info about the newly-pasted geometry
        var pastedClipboardData = FormIt.Clipboard.GetJSONStringForClipboard();
        
        var pastedGeometryIDs = FormIt.Selection.GetSelections();

        // determine if the pasted geometry has the ManageCameras attribute
        var isPastedGeometryFromManageCameras;
        if (pastedGeometryIDs.length > 0)
        {
            var stringAttributeResult = WSM.Utils.GetStringAttributeForObject(ManageCameras.cameraContainerGroupHistoryID, pastedGeometryIDs[0]["ids"][0]["Object"], ManageCameras.cameraStringAttributeKey);
            if (pastedGeometryIDs.length === 1 && stringAttributeResult.success)
            {
                isPastedGeometryFromManageCameras = true;
            }
            else
            {
                isPastedGeometryFromManageCameras = false;
            }
        }

        // check if the clipboard data is valid
        var validPaste = FormIt.Clipboard.SetJSONStringFromClipboard(pastedClipboardData);

        // if the result was a valid paste and was generated from ManageCameras
        if (validPaste && isPastedGeometryFromManageCameras)
        {
            // delete the existing cameras Group if it exists - it'll be replaced by the clipboard contents
            if (!isNaN(cameraContainerGroupID))
            {
                WSM.APIDeleteObject(ManageCameras.cameraContainerGroupHistoryID, cameraContainerGroupID);
            }

            // redefine the camera container group as what was just pasted
            cameraContainerGroupID = (FormIt.PluginUtils.Application.getGroupInstancesByStringAttributeKey(ManageCameras.cameraContainerGroupHistoryID, ManageCameras.cameraStringAttributeKey))[0];

            FormIt.Selection.ClearSelections();
        }
        // otherwise, the paste either wasn't valid or wasn't from ManageCameras, so delete it
        // assumes the pasted geometry is still selected
        else
        {
            FormIt.Commands.DoCommand('Edit: Delete');
        }
    }

    // get the history for the cameras
    var cameraContainerGroupRefHistoryID = WSM.APIGetGroupReferencedHistoryReadOnly(ManageCameras.cameraContainerGroupHistoryID, cameraContainerGroupID);
    // get a list of instances inside the camera container
    var cameraObjectIDs = WSM.APIGetAllObjectsByTypeReadOnly(cameraContainerGroupRefHistoryID, WSM.nObjectType.nInstanceType);

    // only proceed if the Cameras Group exists, and it contains camera objects
    if (!isNaN(cameraContainerGroupID) && cameraObjectIDs)
    {
        // get the existing scenes
        var existingScenes = FormIt.Scenes.GetScenes();

        // keep track of how many existing Scenes were updated, and how many new Scenes were added
        var updatedSceneCount = 0;
        var addedSceneCount = 0;

        // for each existing Scene, check if a Camera has the same name and update it
        for (var i = 0; i < existingScenes.length; i++)
        {
            for (var j = 0; j < cameraObjectIDs.length; j++)
            {
                // check if this camera object has a string attribute
                var stringAttributeResult = WSM.Utils.GetStringAttributeForObject(cameraContainerGroupRefHistoryID, cameraObjectIDs[j], ManageCameras.cameraStringAttributeKey);
                if (stringAttributeResult.success)
                {
                    // check if this camera object's Scene Data name matches the scene name
                    if (JSON.parse(stringAttributeResult.value).SceneData.name == existingScenes[i].name)
                    {
                        // first, delete the existing scene - we're going to replace it
                        FormIt.Scenes.RemoveScene(existingScenes[i].name);

                        // now add the scene with the new data
                        FormIt.Scenes.AddScene(JSON.parse(stringAttributeResult.value).SceneData);
                        // add the scene to an animation if necessary
                        ManageCameras.addSceneToAnimation(stringAttributeResult);

                        console.log("Updated existing Scene " + existingScenes[i].name + " from matching Camera name.");

                        // remove this camera from the list, so the next step can add the remaining cameras
                        cameraObjectIDs.splice(j, 1);

                        // add this to the count of updated scenes
                        updatedSceneCount++;
                    }
                }
            }
        }

        // at this point, the cameraObjectIDs have had items removed for cameras already accounted for by an existing scene
        // so for each remaining camera, create a new scene
        for (var i = 0; i < cameraObjectIDs.length; i++)
        {
            var stringAttributeResult = WSM.Utils.GetStringAttributeForObject(cameraContainerGroupRefHistoryID, cameraObjectIDs[i], ManageCameras.cameraStringAttributeKey);
            FormIt.Scenes.AddScene(JSON.parse(stringAttributeResult.value).SceneData);
            // add the scene to an animation if necessary
            ManageCameras.addSceneToAnimation(stringAttributeResult);
            console.log("Added a new Scene from a Camera: " + JSON.parse(stringAttributeResult.value).SceneData.name);

            // add this to the count of added scenes
            addedSceneCount++;
        }

        // if there were cameras not accounted for by existing scenes,
        // regenereate cameras from the newly-added Scenes to keep cameras and scenes in sync
        if (cameraObjectIDs.length > 0)
        {
            ManageCameras.executeGenerateCameraGeometry(args);
        }

        // finished updating scenes, so var the user know what was changed
        var addedSceneWord;
        var updatedSceneWord;
        if (addedSceneCount === 0 || addedSceneCount > 1)
        {
            addedSceneWord = "Scenes";
        }
        else
        {
            addedSceneWord = "Scene";
        }

        if (updatedSceneCount === 0 || updatedSceneCount > 1)
        {
            updatedSceneWord = "Scenes";
        }
        else
        {
            updatedSceneWord = "Scene";
        }

        var finishUpdateScenesMessage = "Added " + addedSceneCount + " new " + addedSceneWord + " and updated " + updatedSceneCount + " existing " + updatedSceneWord + " from Cameras.";
        FormIt.UI.ShowNotification(finishUpdateScenesMessage, FormIt.NotificationType.Success, 0);
        console.log(finishUpdateScenesMessage);
        return;
    }
    else
    {
        // no Cameras were found
        var noCamerasMessage = "No Cameras found in this project, or on the Clipboard.\nRun 'Export Scenes to Cameras' first, then try again.";
        FormIt.UI.ShowNotification(noCamerasMessage, FormIt.NotificationType.Error, 0);
        console.log(noCamerasMessage);
        return;
    }
}

// adds a scene to an animation if required
ManageCameras.addSceneToAnimation = function(sceneAndAnimationData)
{
    var sceneName = JSON.parse(sceneAndAnimationData.value).SceneData.name;
    var animationName = JSON.parse(sceneAndAnimationData.value).AnimationName;
    var bAnimationLoop = JSON.parse(sceneAndAnimationData.value).AnimationLoop;

    // only do something if the scene belongs to an animation
    if (animationName != "")
    {
        // check if the animation exists already
        var bAnimationExists = (FormIt.Scenes.GetSceneAnimation(animationName)).Result;

        // if the animation exists, make sure the incoming loop setting overwrites the existing
        if (bAnimationExists)
        {
            FormIt.Scenes.SetAnimationLoop(animationName, bAnimationLoop);
        }
        // otherwise, create the animation
        else
        {
            var defaultName = (FormIt.Scenes.AddSceneAnimation()).Name;
            FormIt.Scenes.SetAnimationName(defaultName, animationName);
        }

        // now add the scene to the animation
        FormIt.Scenes.AddScenesToAnimation(animationName, sceneName, "", true);
    }
}

ManageCameras.getCameraPlaneHistoryID = function(nCameraObjectContainerHistoryID, nCameraObjectInstanceID)
{
    var matchPhotoObjectHistoryID = WSM.APIGetGroupReferencedHistoryReadOnly(nCameraObjectContainerHistoryID, nCameraObjectInstanceID);

    // the camera object contains two instances - one for the frustum lines, one for the camera plane
    var aCameraObjectNestedInstanceIDs = WSM.APIGetAllObjectsByTypeReadOnly(matchPhotoObjectHistoryID, WSM.nObjectType.nInstanceType);

    for (var i = 0; i < aCameraObjectNestedInstanceIDs.length; i++)
    {
        var nestedHistoryID = WSM.APIGetGroupReferencedHistoryReadOnly(matchPhotoObjectHistoryID, aCameraObjectNestedInstanceIDs[i]);

        var nFaceID = WSM.APIGetAllObjectsByTypeReadOnly(nestedHistoryID, WSM.nObjectType.nFaceType);

        if (nFaceID != null)
        {
            return nestedHistoryID;
        }
    }
}

ManageCameras.getCameraDataFromCameraObjectAttribute = function(nContextHistoryID, nCameraObjectInstanceID)
{
    return WSM.Utils.GetStringAttributeForObject(nContextHistoryID, nCameraObjectInstanceID, ManageCameras.cameraStringAttributeKey).value;
}

ManageCameras.setCameraDataInCameraObjectAttribute = function(nContextHistoryID, nCameraObjectInstanceID, cameraData)
{
    // store the camera data on the camera instance
    WSM.Utils.SetOrCreateStringAttributeForObject(nContextHistoryID,
        nCameraObjectInstanceID, ManageCameras.cameraStringAttributeKey, JSON.stringify(cameraData));
}

// this is called by the submit function from the panel - all steps to execute the generation of camera geometry
ManageCameras.executeGenerateCameraGeometry = function(bCopyToClipboard)
{
    console.clear();
    console.log("Manage Scene Cameras plugin\n");

    // get all the scenes
    var allScenes = FormIt.Scenes.GetScenes();
    //console.log(JSON.stringify("Scenes: " + JSON.stringify(allScenes)));

    if (allScenes.length === 0)
    {
        // no Scenes found
        var noScenesMessage = "No Scenes found in this project.\nCreate one or more Scenes, then try again.";
        FormIt.UI.ShowNotification(noScenesMessage, FormIt.NotificationType.Error, 0);
        console.log(noScenesMessage);
        return;
    }

    // get the current camera aspect ratio to use for geometry
    // the distance supplied here is arbitrary
    var currentAspectRatio = FormIt.PluginUtils.Application.getViewportAspectRatio();

    // start an undo manager state - this should suspend WSM and other updates to make this faster
    FormIt.UndoManagement.BeginState();

    // create the camera geometry for all scenes
    ManageCameras.createCameraGeometryForScenes(ManageCameras.cameraContainerGroupHistoryID, allScenes, currentAspectRatio, bCopyToClipboard);

    // end the undo manager state
    FormIt.UndoManagement.EndState("Export Scenes to Cameras");
}

// this is called by the submit function from the panel - all steps to execute the update of FormIt scenes to match Camera geometry
ManageCameras.executeUpdateScenesFromCameras = function(args)
{
    console.clear();
    console.log("Manage Scene Cameras plugin\n");

    FormIt.UndoManagement.BeginState();

    // create the camera geometry for all scenes
    ManageCameras.updateScenesFromCameras(args);

    FormIt.UndoManagement.EndState("Import Scenes from Cameras");
}
