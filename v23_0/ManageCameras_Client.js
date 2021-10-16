if (typeof ManageCameras == 'undefined')
{
    ManageCameras = {};
}

/*** application code - runs asynchronously from plugin process to communicate with FormIt ***/

// the container Group for cameras will be created in the Main History (0)
ManageCameras.cameraContainerGroupHistoryID = 0;

// the name of the container Group that will contain all cameras
ManageCameras.cameraContainerGroupAndLayerName = "Cameras";

// the string attribute key used for all Manage Cameras objects
ManageCameras.cameraStringAttributeKey = "FormIt::Plugins::ManageCameras";

// updates variables about the camera
ManageCameras.getCurrentCameraData = async function()
{
    let currentCameraData = await FormIt.Cameras.GetCameraData();
    let currentCameraHeightAboveGround = currentCameraData.posZ;

    let currentLevelsData = await FormIt.Levels.GetLevelsData (0, true);
    let closestLevelName;
    let closestLevelElevation = 0;

    // get the closest level below the camera
    for (let i = 0; i < currentLevelsData.length; i++)
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
        "currentCameraData" : await FormIt.Cameras.GetCameraData(),
        "cameraHeightAboveGroundStr" : await FormIt.StringConversion.LinearValueToString(currentCameraHeightAboveGround),
        "currentLevelsData" : currentLevelsData,
        "closestLevelName" : closestLevelName,
        "closestLevelElevationStr" : await FormIt.StringConversion.LinearValueToString(closestLevelElevation),
        "cameraHeightAboveLevelStr" : await FormIt.StringConversion.LinearValueToString(currentCameraHeightAboveGround - closestLevelElevation)
    }
}

// updates variables about the camera
ManageCameras.setCameraHeightFromLevel = async function(args)
{
    let newCameraHeightFromLevel = 0;
    let closestLevelElevation = 0;

    // if the input value is a number, use it as-is
    if (!isNaN(Number(args.newCameraHeightFromLevelStr)))
    {
        newCameraHeightFromLevel = FormIt.PluginUtils.currentUnits(Number(args.newCameraHeightFromLevelStr));
    }
    // otherwise, convert the string to a number
    else
    {
        newCameraHeightFromLevel = await FormIt.StringConversion.StringToLinearValue(args.newCameraHeightFromLevelStr).second;
    }

    // if the input value is a number, use it as-is
    if (!isNaN(Number(args.closestLevelElevationStr)))
    {
        closestLevelElevation = FormIt.PluginUtils.currentUnits(Number(args.closestLevelElevationStr));
    }
    // otherwise, convert the string to a number
    else
    {
        closestLevelElevation = await FormIt.StringConversion.StringToLinearValue(args.closestLevelElevationStr).second;
    }

    let newCameraData = args.currentCameraData;
    newCameraData.posZ = closestLevelElevation + newCameraHeightFromLevel;

    await FormIt.Cameras.SetCameraData(newCameraData);
}

ManageCameras.setCameraHeightFromGround = async function(args)
{
    let newCameraHeightFromGround = 0;

    // if the input value is a number, use it as-is
    if (!isNaN(Number(args.newCameraHeightFromGroundStr)))
    {
        newCameraHeightFromGround = FormIt.PluginUtils.currentUnits(Number(args.newCameraHeightFromGroundStr));
    }
    // otherwise, convert the string to a number
    else
    {
        newCameraHeightFromGround = await FormIt.StringConversion.StringToLinearValue(args.newCameraHeightFromGroundStr).second;
    }

    let newCameraData = args.currentCameraData;
    newCameraData.posZ = newCameraHeightFromGround;

    await FormIt.Cameras.SetCameraData(newCameraData);
}

ManageCameras.getScreenPointInWorldSpace = async function(x, y, planeDistance)
{
    // get a pickray at the provided screen point (normalized 0-1)
    let pickray = await WSM.Utils.PickRayFromNormalizedScreenPoint(x, y);
    //console.log(JSON.stringify(pickray));

    pickrayPoint = pickray.pickrayLine.point;
    pickrayVector = pickray.pickrayLine.vector;

    newPickrayPointX = pickrayPoint.x + pickrayVector.x * planeDistance;
    newPickrayPointY = pickrayPoint.y + pickrayVector.y * planeDistance;
    newPickrayPointZ = pickrayPoint.z + pickrayVector.z * planeDistance;
    //console.log(newPickrayPointX + ',' + newPickrayPointY + ',' + newPickrayPointZ);

    let pickrayPoint3d = await WSM.Geom.Point3d(newPickrayPointX, newPickrayPointY, newPickrayPointZ);

    return pickrayPoint3d;
}

ManageCameras.getViewportAspectRatioByPickray = async function(distance)
{
    // get the lower left and upper right screen points
    let lowerLeftPoint = await ManageCameras.getScreenPointInWorldSpace(0, 1, distance);
    let lowerRightPoint = await ManageCameras.getScreenPointInWorldSpace(1, 1, distance);
    let upperLeftPoint = await ManageCameras.getScreenPointInWorldSpace(0, 0, distance);

    // calculate the viewport width and height
    let viewportWidth = getDistanceBetweenTwoPoints(lowerRightPoint.x, lowerRightPoint.y, lowerRightPoint.z, lowerLeftPoint.x, lowerLeftPoint.y, lowerLeftPoint.z);
    let viewportHeight = getDistanceBetweenTwoPoints(upperLeftPoint.x, upperLeftPoint.y, upperLeftPoint.z, lowerLeftPoint.x, lowerLeftPoint.y, lowerLeftPoint.z);

    // determine the aspect ratio
    let aspectRatio = viewportWidth/viewportHeight;

    // TODO: replace this function with one that doesn't require a pickray
    // the following API will be available in v20 - will be fewer steps to get the aspect ratio, and won't require pickray
    //let viewportSize = FormIt.Cameras.GetViewportSize();
    
    return aspectRatio;
}

// get Group instances in this history with a particular string attribute key
ManageCameras.getGroupInstanceByStringAttributeKey = async function(nHistoryID, stringAttributeKey)
{
    // get all the instances in this history
    let potentialCameraContainerObjectsArray = await WSM.APIGetAllObjectsByTypeReadOnly(nHistoryID, WSM.nObjectType.nInstanceType);

    // for each of the objects in this history, look for ones with a particular string attribute key
    for (let i = 0; i < potentialCameraContainerObjectsArray.length; i++)
    {
        let objectID = potentialCameraContainerObjectsArray[i];
        //console.log("Object ID: " + objectID);

        let objectHasStringAttributeResult = await WSM.Utils.GetStringAttributeForObject(nHistoryID, objectID, stringAttributeKey);
        // if this object has a string attribute matching the given key, delete it
        if (objectHasStringAttributeResult.success == true)
        {
            return objectID;
        }
    }
}

// delete Group instances in this history with this string attribute key,
// then replace them with a new one
ManageCameras.createOrReplaceGroupInstanceByStringAttributeKey = async function(nHistoryID, stringAttributeKey, newValue)
{
    // get all the objects in the designated Camera container Group history
    let potentialCameraContainerObjectsArray = await WSM.APIGetAllObjectsByTypeReadOnly(nHistoryID, WSM.nObjectType.nInstanceType);

    // for each of the objects in this history, look for ones with a particular string attribute key
    for (let i = 0; i < potentialCameraContainerObjectsArray.length; i++)
    {
        let objectID = potentialCameraContainerObjectsArray[i];
        //console.log("Object ID: " + objectID);

        let objectHasStringAttributeResult = await WSM.Utils.GetStringAttributeForObject(nHistoryID, objectID, stringAttributeKey);
        // if this object has a string attribute matching the given key, delete it
        if (objectHasStringAttributeResult.success == true)
        {
            await WSM.APIDeleteObject(nHistoryID, objectID);
        }
    }

    // now that any existing Camera container Groups have been deleted, make a new one
    let newGroupID = await WSM.APICreateGroup(nHistoryID, [])
    // get the instance ID of the Group
    let newGroupInstanceID = JSON.parse(await WSM.APIGetObjectsByTypeReadOnly(nHistoryID, newGroupID, WSM.nObjectType.nInstanceType));

    // add an attribute to the camera container
    await WSM.Utils.SetOrCreateStringAttributeForObject(nHistoryID,
        newGroupInstanceID, ManageCameras.cameraStringAttributeKey, newValue);

    return newGroupID;
}

// create a layer by name, if it doesn't exist already, and return its ID
ManageCameras.getOrCreateLayerByName = async function(nHistoryID, layerName)
{
    // if the named layer doesn't exist, create it
    if (!await FormIt.Layers.LayerExists(layerName))
    {
        await FormIt.Layers.AddLayer(nHistoryID, layerName, true);
        console.log("Created a new Layer: " + "'" + layerName + "'");
    }
    else 
    {
        console.log("Layer " + "'" + layerName + "'" + " already exists");
    }

    // need to figure out what ID is
    // start by getting all Layers
    let allLayers = await FormIt.Layers.GetLayerList();

    let layerID = undefined;

    // look for the Cameras layer by name, and get the ID
    for (let i = 0; i < allLayers.length; i++)
    {
        if (allLayers[i].Name == layerName)
        {
            layerID = allLayers[i].Id;
            //console.log("Matching Layer ID: " + cameraContainerGroupLayerID);
            break;
        }
    }
    
    return layerID;
}

ManageCameras.createSceneCameraGeometry = async function(nHistoryID, scenes, aspectRatio, args)
{
    console.log("Building scene camera geometry...");

    // create or find the Cameras layer, and get its ID
    let camerasLayerID = await ManageCameras.getOrCreateLayerByName(ManageCameras.cameraContainerGroupHistoryID, ManageCameras.cameraContainerGroupAndLayerName);

    // create a camera container Group
    let cameraContainerGroupID = await ManageCameras.createOrReplaceGroupInstanceByStringAttributeKey(nHistoryID, ManageCameras.cameraStringAttributeKey, "CameraContainer");
    // get the instance ID of the Group
    let cameraContainerGroupInstanceID = JSON.parse(await WSM.APIGetObjectsByTypeReadOnly(nHistoryID, cameraContainerGroupID, WSM.nObjectType.nInstanceType));
    // get the history for the camera container Group
    let cameraContainerGroupRefHistoryID = await WSM.APIGetGroupReferencedHistoryReadOnly(nHistoryID, cameraContainerGroupID);

    // put the camera container group on the cameras layer
    await FormIt.Layers.AssignLayerToObjects(camerasLayerID, cameraContainerGroupInstanceID);

    // set the name of the camera container group
    await WSM.APISetObjectProperties(nHistoryID, cameraContainerGroupInstanceID, ManageCameras.cameraContainerGroupAndLayerName, false);
    // set the name of the camera container group instance
    await WSM.APISetRevitFamilyInformation(cameraContainerGroupRefHistoryID, false, false, "", ManageCameras.cameraContainerGroupAndLayerName, "", "");

    // keep track of how many cameras were created
    let camerasCreatedCount = 0;

    // for each scene, get the camera data and recreate the camera geometry from the data
    for (let i = 0; i < scenes.length; i++)
    {
        let sceneData = scenes[i];
        //console.log("Camera: " + sceneCamera);

        let sceneName = scenes[i].name;
        //console.log("Scene name: " + sceneName);

        // create the geometry for this camera
        await ManageCameras.createCameraGeometryFromData(sceneData, cameraContainerGroupRefHistoryID, sceneName, aspectRatio);

        camerasCreatedCount++;

        console.log("Built new camera: " + sceneName);
    }

    let camerasWord;
    if (camerasCreatedCount === 0 || camerasCreatedCount > 1)
    {
        camerasWord = "Cameras";
    }
    else
    {
        camerasWord = "Camera";
    }

    // finished creating cameras, so let the user know what was changed
    let finishCreateCamerasMessage = "Created " + camerasCreatedCount + " new " + camerasWord + " from Scenes.";
    await FormIt.UI.ShowNotification(finishCreateCamerasMessage, FormIt.NotificationType.Information, 0);
    console.log(finishCreateCamerasMessage);

    // if specified, copy the new cameras to the clipboard
    let copyToClipboard = args.copyToClipboard;

    if (copyToClipboard)
    {
        // copy the new Camera container Group to the clipboard
        await FormIt.Selection.ClearSelections();
        await FormIt.Selection.AddSelections(cameraContainerGroupID);
        
        // ctrl + C
        // TODO: there's got to be a better way to do this
        // this requires user's cursor to be in the 3D canvas
        await FormIt.Events.KeyDown(67, 2, "\u0003");
        await FormIt.Selection.ClearSelections();
    }
}

// creates camera geometry from camera data
ManageCameras.createCameraGeometryFromData = async function(sceneData, nHistoryID, sceneName, aspectRatio)
{
    // distance from the point to the camera plane
    let cameraDepth = 5;

    // cameras will need to be moved to the origin, then Grouped, then moved back (to get the LCS correct)
    let origin = await WSM.Geom.Point3d(0, 0, 0);

    // get the FOV from the camera data
    let FOV = sceneData.camera.FOV;

    // determine the normalized view width and height
    if (aspectRatio <= 1.0) {
        width = Math.tan(FOV);
        height = width / aspectRatio;
    } else {
        height = Math.tan(FOV);
        width = height * aspectRatio;
    }

    // multiply the width and height by distance
    height *= cameraDepth;
    width *= cameraDepth;

    // construct the camera forward vector
    let cameraForwardVector = multiplyVectorByQuaternion(0, 0, -1, sceneData.camera.rotX, sceneData.camera.rotY, sceneData.camera.rotZ, sceneData.camera.rotW);
    // scale the vector by the distance
    cameraForwardVector = scaleVector(cameraForwardVector, cameraDepth);
    let cameraForwardVector3d = await WSM.Geom.Vector3d(cameraForwardVector[0], cameraForwardVector[1], cameraForwardVector[2]);
    //console.log(JSON.stringify(cameraForwardVector3d));

    // construct the camera up vector
    let cameraUpVector = multiplyVectorByQuaternion(0, 1, 0, sceneData.camera.rotX, sceneData.camera.rotY, sceneData.camera.rotZ, sceneData.camera.rotW);   
    // scale the vector by the  height
    cameraUpVector = scaleVector(cameraUpVector, height);
    let cameraUpVector3d = await WSM.Geom.Vector3d(cameraUpVector[0], cameraUpVector[1], cameraUpVector[2]);
    //console.log(JSON.stringify(cameraUpVector3d));

    // construct the camera right vector
    let cameraRightVector = multiplyVectorByQuaternion(-1, 0, 0, sceneData.camera.rotX, sceneData.camera.rotY, sceneData.camera.rotZ, sceneData.camera.rotW);
    // scale the vector by the  width
    cameraRightVector = scaleVector(cameraRightVector, width);
    let cameraRightVector3d = await WSM.Geom.Vector3d(cameraRightVector[0], cameraRightVector[1], cameraRightVector[2]);
    //console.log(JSON.stringify(cameraRightVector3d));

	// get the current camera's position
    let cameraPosition = await WSM.Geom.Point3d(sceneData.camera.posX, sceneData.camera.posY, sceneData.camera.posZ);
    //console.log(JSON.stringify(cameraPosition));

    // construct the 4 corners of the camera

    // lower left
    let point0x = cameraPosition.x + cameraForwardVector3d.x - cameraRightVector3d.x - cameraUpVector3d.x;
    let point0y = cameraPosition.y + cameraForwardVector3d.y - cameraRightVector3d.y - cameraUpVector3d.y;
    let point0z = cameraPosition.z + cameraForwardVector3d.z - cameraRightVector3d.z - cameraUpVector3d.z;
    let point0 = await WSM.Geom.Point3d(point0x, point0y, point0z);

    // upper left
    let point1x = cameraPosition.x + cameraForwardVector3d.x - cameraRightVector3d.x + cameraUpVector3d.x;
    let point1y = cameraPosition.y + cameraForwardVector3d.y - cameraRightVector3d.y + cameraUpVector3d.y;
    let point1z = cameraPosition.z + cameraForwardVector3d.z - cameraRightVector3d.z + cameraUpVector3d.z;
    let point1 = await WSM.Geom.Point3d(point1x, point1y, point1z);

    // upper right
    let point2x = cameraPosition.x + cameraForwardVector3d.x + cameraRightVector3d.x + cameraUpVector3d.x;
    let point2y = cameraPosition.y + cameraForwardVector3d.y + cameraRightVector3d.y + cameraUpVector3d.y;
    let point2z = cameraPosition.z + cameraForwardVector3d.z + cameraRightVector3d.z + cameraUpVector3d.z;
    let point2 = await WSM.Geom.Point3d(point2x, point2y, point2z);

    // lower right
    let point3x = cameraPosition.x + cameraForwardVector3d.x + cameraRightVector3d.x - cameraUpVector3d.x;
    let point3y = cameraPosition.y + cameraForwardVector3d.y + cameraRightVector3d.y - cameraUpVector3d.y;
    let point3z = cameraPosition.z + cameraForwardVector3d.z + cameraRightVector3d.z - cameraUpVector3d.z;
    let point3 = await WSM.Geom.Point3d(point3x, point3y, point3z);

    // all camera points
    let points = [point0, point1, point2, point3];

    // the end points of the camera frustum lines
    let frustumLineEndoints0 = [cameraPosition, point0];
    let frustumLineEndpoints1 = [cameraPosition, point1];
    let frustumLineEndpoints2 = [cameraPosition, point2];
    let frustumLineEndpoints3 = [cameraPosition, point3];

    // set up an array to capture all camera geometry objects
    let cameraObjectIDs = [];

    // create a vertex at the camera position
    let cameraPosVertexObjectID = await WSM.APICreateVertex(nHistoryID, cameraPosition);

    let frustumLinesObjectIDs = [];
    // create lines from the camera position to the camera corners
    let frustumLine0 = await WSM.APICreatePolyline(nHistoryID, frustumLineEndoints0, false);
    frustumLinesObjectIDs.push(WSM.APIGetCreatedChangedAndDeletedInActiveDeltaReadOnly(nHistoryID, WSM.nObjectType.nEdgeType).created);
    let frustumLine1 = await WSM.APICreatePolyline(nHistoryID, frustumLineEndpoints1, false);
    frustumLinesObjectIDs.push(WSM.APIGetCreatedChangedAndDeletedInActiveDeltaReadOnly(nHistoryID, WSM.nObjectType.nEdgeType).created);
    let frustumLine2 = await WSM.APICreatePolyline(nHistoryID, frustumLineEndpoints2, false);
    frustumLinesObjectIDs.push(WSM.APIGetCreatedChangedAndDeletedInActiveDeltaReadOnly(nHistoryID, WSM.nObjectType.nEdgeType).created);
    let frustumLine3 = await WSM.APICreatePolyline(nHistoryID, frustumLineEndpoints3, false);
    frustumLinesObjectIDs.push(WSM.APIGetCreatedChangedAndDeletedInActiveDeltaReadOnly(nHistoryID, WSM.nObjectType.nEdgeType).created);

    // connect the points with a rectangle - this will create a rectangular surface in front of the camera
    await WSM.APICreatePolyline(nHistoryID, points, true);

    // get the faces and push it into the array
    let faceObjectID = await WSM.APIGetCreatedChangedAndDeletedInActiveDeltaReadOnly(nHistoryID, WSM.nFaceType).created;

    // add the camera position vertex and the frustum lines to the camera geometry array
    //cameraObjectIDs.push(cameraPosVertexObjectID);
    cameraObjectIDs.push(frustumLinesObjectIDs);
    cameraObjectIDs.push(faceObjectID);

    cameraObjectIDs = flattenArray(cameraObjectIDs);

    //
    // we want to put the camera in a Group, and set the LCS to align with the camera geometry
    // to do this, we need to move the camera to the origin, and rotate it in 3D to point along an axis
    // then make it into a Group, so the Group's origin and axis alignments match the camera plane
    // 

    // get the vector from the camera's position to the origin
    let cameraToOriginVector = getVectorBetweenTwoPoints(cameraPosition.x, cameraPosition.y, cameraPosition.z, 0, 0, 0);
    // convert the vector to the resulting WSM point3d
    let translatedCameraPositionPoint3d = await WSM.Geom.Point3d(cameraToOriginVector[0], cameraToOriginVector[1], cameraToOriginVector[2]);

    // create a transform for moving the camera to the origin, keeping its current orientation
    let cameraMoveToOriginTransform = await WSM.Geom.MakeRigidTransform(translatedCameraPositionPoint3d, await WSM.Geom.Vector3d(1, 0, 0), await WSM.Geom.Vector3d(0, 1, 0), await WSM.Geom.Vector3d(0, 0, 1));


    // create a transform for rotating the camera to face an axis
    // this requires the geometry to be at the world origin
    // the position of cameraForwardVector3d determines which axis the camera will face
    let cameraRotateToAxisTransform = await WSM.Geom.MakeRigidTransform(origin, cameraRightVector3d, cameraUpVector3d, cameraForwardVector3d);
    // invert the transform
    let cameraRotateToAxisTransformInverted = await WSM.Geom.InvertTransform(cameraRotateToAxisTransform);

    // first, only move the camera to the origin (no rotation)
    await WSM.APITransformObjects(nHistoryID, cameraObjectIDs, cameraMoveToOriginTransform);

    // now rotate the camera to face the axis
    await WSM.APITransformObjects(nHistoryID, cameraObjectIDs, cameraRotateToAxisTransformInverted);

    // 
    // now that the camera is at the origin, and aligned correctly, we can Group it
    //

    // create a new Group for this Scene's Camera
    let cameraGroupID = await WSM.APICreateGroup(nHistoryID, cameraObjectIDs);
    // get the instance ID of the Group
    let cameraGroupInstanceID = JSON.parse(await WSM.APIGetObjectsByTypeReadOnly(nHistoryID, cameraGroupID, WSM.nObjectType.nInstanceType));
    // create a new history for the camera
    let cameraGroupHistoryID = await WSM.APIGetGroupReferencedHistoryReadOnly(nHistoryID, cameraGroupID);

    //
    // put the camera plane in its own Group, with the origin at the centroid
    //

    // get the face - this is the camera plane
    // this assumes there's only 1 face represented from the camera geometry
    let newContextCameraViewPlaneFaceID = JSON.parse(await WSM.APIGetCreatedChangedAndDeletedInActiveDeltaReadOnly(cameraGroupHistoryID, WSM.nFaceType).created);
    
    let cameraViewPlaneCentroidPoint3d = await WSM.APIGetFaceCentroidPoint3dReadOnly(cameraGroupHistoryID, newContextCameraViewPlaneFaceID);
    //console.log(cameraViewPlaneCentroidPoint3d);

    // set the name of the camera group
    await WSM.APISetRevitFamilyInformation(cameraGroupHistoryID, false, false, "", "Camera-" + sceneName, "", "");
    // set the name of the camera group instance
    await WSM.APISetObjectProperties(cameraGroupHistoryID, cameraGroupInstanceID, sceneName, false);

    // add an attribute to the camera with the current camera data
    let value = { SceneData: sceneData };
    await WSM.Utils.SetOrCreateStringAttributeForObject(nHistoryID,
        cameraGroupInstanceID, ManageCameras.cameraStringAttributeKey, JSON.stringify(value));

    let cameraViewPlaneMoveToOriginVector = getVectorBetweenTwoPoints(cameraViewPlaneCentroidPoint3d.x, cameraViewPlaneCentroidPoint3d.y, cameraViewPlaneCentroidPoint3d.z, 0, 0, 0);
    let translatedCameraPlanePositionPoint3d = await WSM.Geom.Point3d(cameraViewPlaneMoveToOriginVector[0], cameraViewPlaneMoveToOriginVector[1], cameraViewPlaneMoveToOriginVector[2]);

    // create a transform for moving the camera plane to the origin
    let cameraPlaneMoveToOriginTransform = await WSM.Geom.MakeRigidTransform(translatedCameraPlanePositionPoint3d, await WSM.Geom.Vector3d(1, 0, 0), await WSM.Geom.Vector3d(0, 1, 0), await WSM.Geom.Vector3d(0, 0, 1));

    // create a transform for moving the camera plane back to its original position
    let cameraViewPlaneReturnToPosTransform = await WSM.Geom.MakeRigidTransform(cameraViewPlaneCentroidPoint3d, await WSM.Geom.Vector3d(1, 0, 0), await WSM.Geom.Vector3d(0, 1, 0), await WSM.Geom.Vector3d(0, 0, 1));

    // move the camera plane to the origin
    await WSM.APITransformObjects(cameraGroupHistoryID, newContextCameraViewPlaneFaceID, cameraPlaneMoveToOriginTransform);

    // create a new Group for the camera viewplane
    let cameraViewPlaneGroupID = await WSM.APICreateGroup(cameraGroupHistoryID, newContextCameraViewPlaneFaceID);

    // get the instanceID of the Group
    let cameraViewPlaneGroupInstanceID = JSON.parse(await WSM.APIGetObjectsByTypeReadOnly(cameraGroupHistoryID, cameraViewPlaneGroupID, WSM.nObjectType.nInstanceType));
    // create a new history for the camera view plane
    let cameraViewPlaneGroupHistoryID = await WSM.APIGetGroupReferencedHistoryReadOnly(cameraGroupHistoryID, cameraViewPlaneGroupID);

    // set the name of the view plane group
    await WSM.APISetRevitFamilyInformation(cameraViewPlaneGroupHistoryID, false, false, "", "ViewPlane", "", "");
    // set the name of the view plane instance
    await WSM.APISetObjectProperties(cameraViewPlaneGroupHistoryID, cameraViewPlaneGroupInstanceID, "View Plane", false);

    // move the view plane instance back to where it belongs
    await WSM.APITransformObjects(cameraGroupHistoryID, cameraViewPlaneGroupID, cameraViewPlaneReturnToPosTransform);

    //
    // move the frustum lines into their own group
    // 

    let newContextFrustumLinesObjectIDs = await WSM.APIGetAllObjectsByTypeReadOnly(cameraGroupHistoryID, WSM.nObjectType.nEdgeType);

    // move the camera frustum lines to the origin
    await WSM.APITransformObjects(cameraGroupHistoryID, newContextFrustumLinesObjectIDs, cameraPlaneMoveToOriginTransform);

    // create a new Group for the camera frustum lines
    let cameraFrustumLinesGroupID = await WSM.APICreateGroup(cameraGroupHistoryID, newContextFrustumLinesObjectIDs);
    // get the instanceID of the Group
    let cameraFrustumLinesGroupInstanceID = JSON.parse(await WSM.APIGetObjectsByTypeReadOnly(cameraGroupHistoryID, cameraFrustumLinesGroupID, WSM.nObjectType.nInstanceType));
    // create a new history for the camera view plane
    let cameraFrustumLinesGroupHistoryID = await WSM.APIGetGroupReferencedHistoryReadOnly(cameraGroupHistoryID, cameraFrustumLinesGroupID);

    // set the name of the view plane group
    await WSM.APISetRevitFamilyInformation(cameraFrustumLinesGroupHistoryID, false, false, "", "FrustumLines", "", "");
    // set the name of the view plane instance
    await WSM.APISetObjectProperties(cameraFrustumLinesGroupHistoryID, cameraFrustumLinesGroupInstanceID, "Frustum Lines", false);

    // move the frustum lines instance back to where it belongs
    await WSM.APITransformObjects(cameraGroupHistoryID, cameraFrustumLinesGroupID, cameraViewPlaneReturnToPosTransform);

    //
    // now move the Group Instance back to the camera's original position
    //

    // create a tranform to move the camera back and reset its alignment to where it was
    let cameraReturnToCameraPosTransform = await WSM.Geom.MakeRigidTransform(cameraPosition, cameraRightVector3d, cameraUpVector3d, cameraForwardVector3d);

    // move and rotate the camera back
    await WSM.APITransformObjects(nHistoryID, cameraGroupInstanceID, cameraReturnToCameraPosTransform);

    //
    // move the camera position vertex into the camera Group
    //

    await WSM.APICopyOrSketchAndTransformObjects(nHistoryID, cameraGroupHistoryID, cameraPosVertexObjectID, cameraMoveToOriginTransform, 1);
    await WSM.APIDeleteObject(nHistoryID, cameraPosVertexObjectID);
}

ManageCameras.updateScenesFromCameras = async function(args)
{
    // first, check if the Cameras Group exists
    let cameraContainerGroupID = await ManageCameras.getGroupInstanceByStringAttributeKey(ManageCameras.cameraContainerGroupHistoryID, ManageCameras.cameraStringAttributeKey);

    // if specified, use the clipboard data to find the new cameras
    if (args.useClipboard)
    {
        // first, ensure the user is in the Main History, with nothing selected
        await FormIt.GroupEdit.EndEditInContext();
        await FormIt.Selection.ClearSelections();

        // paste in place
        // ctrl + shift + v
        await FormIt.Events.KeyDown(86, 3, "\u0016");

        // the new geometry should be selected, so get some info about the newly-pasted geometry
        let pastedClipboardData = await FormIt.Clipboard.GetJSONStringForClipboard();
        
        let pastedGeometryIDs = await FormIt.Selection.GetSelections();

        // determine if the pasted geometry has the ManageCameras attribute
        let isPastedGeometryFromManageCameras;
        if (pastedGeometryIDs.length > 0)
        {
            let stringAttributeResult = await WSM.Utils.GetStringAttributeForObject(ManageCameras.cameraContainerGroupHistoryID, pastedGeometryIDs[0]["ids"][0]["Object"], ManageCameras.cameraStringAttributeKey);
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
        let validPaste = await FormIt.Clipboard.SetJSONStringFromClipboard(pastedClipboardData);

        // if the result was a valid paste and was generated from ManageCameras
        if (validPaste && isPastedGeometryFromManageCameras)
        {
            // delete the existing cameras Group if it exists - it'll be replaced by the clipboard contents
            if (!isNaN(cameraContainerGroupID))
            {
                await WSM.APIDeleteObject(ManageCameras.cameraContainerGroupHistoryID, cameraContainerGroupID);
            }

            // redefine the camera container group as what was just pasted
            let cameraContainerGroupID = await ManageCameras.getGroupInstanceByStringAttributeKey(ManageCameras.cameraContainerGroupHistoryID, ManageCameras.cameraStringAttributeKey);

            await FormIt.Selection.ClearSelections();
        }
        // otherwise, the paste either wasn't valid or wasn't from ManageCameras, so delete it
        // assumes the pasted geometry is still selected
        else
        {
            // delete key
            await FormIt.Events.KeyDown(46, 0, "");
        }
    }

    // get the history for the cameras
    let cameraContainerGroupRefHistoryID = await WSM.APIGetGroupReferencedHistoryReadOnly(ManageCameras.cameraContainerGroupHistoryID, cameraContainerGroupID);
    // get a list of instances inside the camera container
    let cameraObjectIDs = await WSM.APIGetAllObjectsByTypeReadOnly(cameraContainerGroupRefHistoryID, WSM.nObjectType.nInstanceType);

    // only proceed if the Cameras Group exists, and it contains camera objects
    if (!isNaN(cameraContainerGroupID) && cameraObjectIDs)
    {
        // get the existing scenes
        let existingScenes = await FormIt.Scenes.GetScenes();

        // keep track of how many existing Scenes were updated, and how many new Scenes were added
        let updatedSceneCount = 0;
        let addedSceneCount = 0;

        // for each existing Scene, check if a Camera has the same name and update it
        for (let i = 0; i < existingScenes.length; i++)
        {
            for (let j = 0; j < cameraObjectIDs.length; j++)
            {
                // check if this camera object has a string attribute
                let stringAttributeResult = await WSM.Utils.GetStringAttributeForObject(cameraContainerGroupRefHistoryID, cameraObjectIDs[j], ManageCameras.cameraStringAttributeKey);
                if (stringAttributeResult.success)
                {
                    // check if this camera object's Scene Data name matches the scene name
                    if (JSON.parse(stringAttributeResult.value).SceneData.name == existingScenes[i].name)
                    {
                        let existingSceneData = JSON.parse(stringAttributeResult.value).SceneData;
                        existingSceneData.camera = JSON.parse(stringAttributeResult.value).SceneData.camera;
                        // replace this scene's data with the camera data
                        existingScenes[i] = existingSceneData;
                        await FormIt.Scenes.SetScenes(existingScenes);
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
        for (let i = 0; i < cameraObjectIDs.length; i++)
        {
            let stringAttributeResult = await WSM.Utils.GetStringAttributeForObject(cameraContainerGroupRefHistoryID, cameraObjectIDs[i], ManageCameras.cameraStringAttributeKey);
            await FormIt.Scenes.AddScene(JSON.parse(stringAttributeResult.value).SceneData);
            console.log("Added a new Scene from a Camera: " + JSON.parse(stringAttributeResult.value).SceneData.name);

            // add this to the count of added scenes
            addedSceneCount++;
        }

        // if there were cameras not accounted for by existing scenes,
        // regenereate cameras from the newly-added Scenes to keep cameras and scenes in sync
        if (cameraObjectIDs.length > 0)
        {
            await ManageCameras.executeGenerateCameraGeometry(args);
        }

        // finished updating scenes, so let the user know what was changed
        let addedSceneWord;
        let updatedSceneWord;
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

        let finishUpdateScenesMessage = "Added " + addedSceneCount + " new " + addedSceneWord + " and updated " + updatedSceneCount + " existing " + updatedSceneWord + " from Cameras.";
        await FormIt.UI.ShowNotification(finishUpdateScenesMessage, FormIt.NotificationType.Information, 0);
        console.log(finishUpdateScenesMessage);
        return;
    }
    else
    {
        // no Cameras were found
        let noCamerasMessage = "No Cameras found in this project, or on the Clipboard.\nRun 'Export Scenes to Cameras' first, then try again.";
        await FormIt.UI.ShowNotification(noCamerasMessage, FormIt.NotificationType.Error, 0);
        console.log(noCamerasMessage);
        return;
    }
}

// this is called by the submit function from the panel - all steps to execute the generation of camera geometry
ManageCameras.executeGenerateCameraGeometry = async function(args)
{
    console.clear();
    console.log("Manage Scene Cameras plugin\n");

    // get all the scenes
    let allScenes = await FormIt.Scenes.GetScenes();
    //console.log(JSON.stringify("Scenes: " + JSON.stringify(allScenes)));

    if (allScenes.length === 0)
    {
        // no Scenes found
        let noScenesMessage = "No Scenes found in this project.\nCreate one or more Scenes, then try again.";
        await FormIt.UI.ShowNotification(noScenesMessage, FormIt.NotificationType.Error, 0);
        console.log(noScenesMessage);
        return;
    }

    // get the current camera aspect ratio to use for geometry
    // the distance supplied here is arbitrary
    let currentAspectRatio = await ManageCameras.getViewportAspectRatioByPickray(10);

    // start an undo manager state - this should suspend WSM and other updates to make this faster
    await FormIt.UndoManagement.BeginState();

    // create the camera geometry for all scenes
    await ManageCameras.createSceneCameraGeometry(ManageCameras.cameraContainerGroupHistoryID, allScenes, currentAspectRatio, args);

    // end the undo manager state
    await FormIt.UndoManagement.EndState("Create camera geometry");
}

// this is called by the submit function from the panel - all steps to execute the update of FormIt scenes to match Camera geometry
ManageCameras.executeUpdateScenesFromCameras = async function(args)
{
    console.clear();
    console.log("Manage Scene Cameras plugin\n");

    // create the camera geometry for all scenes
    await ManageCameras.updateScenesFromCameras(args);
}
