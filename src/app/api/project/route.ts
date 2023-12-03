import { connectMongoDB } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";
import Project from "@/models/project";
import Mentor from "@/models/mentor";
import mongoose, { ObjectId } from "mongoose";

export async function POST(req : NextRequest) {
    try {

        // Connect to database
        await connectMongoDB();
        
        // Get all the required data from request
        const { projectName, projectLink, projectDescription, projectTypes, projectTags, videoLink, mentorId } = await req.json();
        
        // Find the projectOwner in mentor collection
        const mentor = await Mentor.findById(mentorId);

        // If mentor couldn't be found
        if(!mentor) {
            return NextResponse.json({ message: "Mentor couldn't be found" }, {status : 400});
        }

        // Create a new Project
        const project = new Project({
            projectName,
            projectLink,
            projectDescription,
            projectTypes,
            projectTags,
            videoLink,
            projectOwner : mentorId
        });

        // If maximum project limit exist
        if(mentor.RegisteredProjectId.length == 3) {
            return NextResponse.json({ message: "Mentor have already registered 3 projecs" }, {status: 400});
        }


        // Add project in collection
        const savedProject = await project.save();

        // Add the project in mentor's document
        mentor.RegisteredProjectId.push(savedProject._id);
        await mentor.save();

        return NextResponse.json({ message: "Project uploaded successfully." }, { status: 200 });

    } catch (error) {
        console.log(error);
        return NextResponse.json({ message: "An error occurred while uploading project." }, { status: 500 });
    }
}

export async function GET(req : NextRequest) {
    try {

        // Connect to database
        await connectMongoDB();

        // Get all queries
        const queries = req.nextUrl.searchParams;

        // Find all projects
        if(!queries.has("mentorId")){
            const projects = await Project.aggregate([
                {
                    $lookup: {
                        from: 'mentors',
                        localField: 'projectOwner',
                        foreignField: '_id',
                        as: 'ownerDetails'
                    }
                },
                {
                    $project: {
                        'ownerDetails.password': false,
                        'ownerDetails.question1': false,
                        'ownerDetails.question2': false,
                        'ownerDetails.answer1': false,
                        'ownerDetails.answer2': false
                    }
                }
            ]);

            return NextResponse.json({ message: "Projects found successfully.", data : projects }, { status: 200 }); 
        }

        // Find details of a particular mentor
        else{
            const mentor = await Mentor.aggregate([
                {
                    $match: {
                        _id: new mongoose.Types.ObjectId(queries.get("mentorId")!)
                    }
                },
                {
                    $lookup: {
                        from: 'projects',
                        let: { projectIds: "$RegisteredProjectId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $in: ["$_id", "$$projectIds"]
                                    }
                                }
                            }
                        ],
                        as: "registeredProjects"
                    }
                }
            ])
            return NextResponse.json({ message: "Projects found successfully.", data : mentor }, { status: 200 });
        }

    } catch (error) {
        console.log(error);
        return NextResponse.json({ message: "Something Went Wrong." }, { status: 500 });
    }
}

export async function PATCH(req : NextRequest) {
    try {
        // Connect to database
        await connectMongoDB();

        // get data from request
        const { projectId, projectName, projectDescription, projectLink, projectTags, videoLink } = await req.json();

        // Update the datails as require
        await Project.findByIdAndUpdate(projectId, {projectName, projectDescription, projectLink, projectTags, videoLink, edited : true});

        return NextResponse.json({ message: "Project Details updated successfully." }, { status : 200 });

    }catch(error) {
        console.log(error);
        return NextResponse.json({ message: "Something Went Wrong"}, { status : 500 });
    }
}