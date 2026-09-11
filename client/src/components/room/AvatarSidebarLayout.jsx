import React from 'react';
import SignLanguagePanel from './SignLanguagePanel';
import ParticipantRail from './ParticipantRail';

const AvatarSidebarLayout = (props) => {
    return (
        <div className="w-full h-full flex flex-col md:flex-row overflow-hidden flex-wrap md:flex-nowrap p-2 gap-2 bg-[#f6f8fb]">
            {/* Left Column: Sign Avatar Primary Stage */}
            <div className="w-full h-[50vh] md:h-full md:w-[60%] lg:w-[70%] xl:w-[75%] flex flex-col relative z-10 shrink-0">
                <SignLanguagePanel {...props} />
            </div>

            {/* Right Column: Participant Rail */}
            <div className="w-full flex-1 md:h-full md:w-[40%] lg:w-[30%] xl:w-[25%] flex flex-col min-h-[150px]">
                <ParticipantRail {...props} />
            </div>
        </div>
    );
};

export default AvatarSidebarLayout;
